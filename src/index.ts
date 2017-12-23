import * as fs from 'fs'
import * as path from 'path'
import * as Sequelize from 'sequelize'

import relationships, { setRelationship } from './relationships'
import { getElementsInSecondArrayNotPresentInFirstArray } from './util'

export { relationships }

export var connection: Sequelize.Sequelize | null = null

var connectionPromise: PromiseLike<any> | null = null

interface Props {
    methods: {},
    staticMethods: {},
    attributes: {},
    staticAttributes: {},
    relationships: Object[]
}

interface SqtOptions {
    nameOverride?: string
}

function extractPropsFromClassDefinition(obj) {
    let props: Props = {
        methods: {},
        staticMethods: {},
        attributes: {},
        staticAttributes: {},
        relationships: []
    }

    const usedNames = new Set()

    do {
        if (obj.prototype) {
            const tempStatics = Object.getOwnPropertyNames(obj.prototype.constructor).filter((value) =>
                value !== 'length' && value !== 'name' && value !== 'prototype' &&
                !usedNames.has(value)
            )
        
            tempStatics.forEach((value) => {
                if (value !== 'modifySchema') {
                    const pValue = obj.prototype.constructor[value]
    
                    if (typeof pValue === 'function') {
                        props.staticMethods[value] = pValue
                    } else {
                        props.staticAttributes[value] = pValue
                    }
    
                    usedNames.add(value)
                }
            })

            const temp = Object.getOwnPropertyNames(obj.prototype)
            .concat(Object.getOwnPropertySymbols(obj.prototype).map(s => s.toString()))
            .filter((value, i, arr) =>
                value !== 'constructor' &&
                value !== 'modifySchema' &&
                value !== 'sequelize' &&
                value !== '_sqtMetadata' &&
                (i == 0 || value !== arr[i - 1]) &&
                !usedNames.has(value)
            )
        
            temp.forEach((value) => {
                const pValue = obj.prototype[value]
    
                if (typeof pValue === 'function') {
                    props.methods[value] = pValue
                } else {
                    props.attributes[value] = pValue
                }
    
                usedNames.add(value)
            })

            if (obj.prototype._sqtMetadata) {
                if (obj.prototype._sqtMetadata.properties) {
                    Object.assign(props.attributes, obj.prototype._sqtMetadata.properties)
                }
            }
        }

        if (obj._sqtMetadata) {
            if (obj._sqtMetadata.relationships) {
                getElementsInSecondArrayNotPresentInFirstArray(props.relationships, obj._sqtMetadata.relationships)
                .forEach((relationship) => {
                    props.relationships.push(relationship)
                })
            }
        }
    }
    while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj))

    return props
}

export function classToSequelizeSchema(classDefinition: Object['constructor'], options: Sequelize.DefineOptions<any> = {}, sqtOptions: SqtOptions = {}) {
    return function(sequelize: Sequelize.Sequelize) {
        const props = extractPropsFromClassDefinition(classDefinition)

        const newOptions = Object.assign({}, options)

        newOptions['instanceMethods'] = Object.assign({}, newOptions.instanceMethods, props.methods)
        newOptions['classMethods'] = Object.assign({}, newOptions.classMethods, props.staticMethods)

        const schema = sequelize.define(
            (sqtOptions.nameOverride) ? sqtOptions.nameOverride : classDefinition.name,
            props.attributes,
            newOptions
        )

        if (props.relationships && props.relationships.length > 0) {
            schema['associate'] = (_sequelize) => {
                props.relationships.forEach((relationship: any) => {
                    setRelationship(schema, relationship.relationshipType, _sequelize.models[relationship.targetClass], relationship.options, relationship.overrideOptions)
                })
            }
        }

        if (classDefinition['modifySchema']) {
            schema['modifySchema'] = classDefinition['modifySchema'](schema)
        }

        if (!schema['prototype']) {
            schema['prototype'] = {}
        }

        Object.assign(schema['prototype'], props.methods)
        Object.assign(schema, props.staticMethods)

        // console.dir(schema)

        return schema
    }
}

export function setConnection(sequelize: Sequelize.Sequelize) {
    connection = sequelize
}

export function getConnection() {
    if (connectionPromise) {
        return connectionPromise
        .then(() => {
            return connection
        })
    } else {
        throw Error('Sequelize connection was never initiated')
    }
}

function importFiles(sequelize_: Sequelize.Sequelize, schemaDir_: string) { // Note: Not tested against symlinks, avoid infinite loops?
    const db = {}
    const filesToImport: string[] = []
    const directoriesToScan = [schemaDir_]

    while (directoriesToScan.length > 0) {
        const directory = directoriesToScan.pop()

        if (directory) {
            fs.readdirSync(directory)
            .forEach((file) => {
                const absolutePath = path.join(directory, file)
                const stats = fs.statSync(absolutePath)
                
                if (stats.isDirectory()) {
                    directoriesToScan.push(absolutePath)
                } else {
                    filesToImport.push(absolutePath)
                }
            })
        }
    }

    filesToImport
    .filter((file) => {
        const filename = file.split(/\/|\\/).pop()

        if (filename) {
            return (filename.indexOf('.') !== 0) && (filename.split('.').pop() === 'js')
        }

        return false
    })
    .forEach((file) => {
        const model = sequelize_.import(file)
        
        db[model['name']] = model
    })

    return db
}

interface InitializeSequelizeOptions {
    silent?: boolean
}

export function initializeSequelize(sequelize: Sequelize.Sequelize, schemaDir: string, options: InitializeSequelizeOptions = {}): PromiseLike<Sequelize.Sequelize> {
    if (!schemaDir) {
        throw Error('Need a schema dir!')
    }

    if (!options.silent) {
        console.log('Initializing connection...')
    }

    connectionPromise = sequelize
    .authenticate()
    .then(() => {
        if (!options.silent) {
            console.log(`--> connection to ${ sequelize.getDialect() } database established`)
        }
        const db = importFiles(sequelize, schemaDir)

        Object.keys(db).forEach((modelName) => {
            if (db[modelName].hasOwnProperty('modifySchema')) {
                db[modelName].modifySchema(sequelize)
            }

            if (db[modelName].hasOwnProperty('associate')) {
                db[modelName].associate(sequelize)
            }
        })

        connection = sequelize

        if (!options.silent) {
            console.log(`--> ${ sequelize.getDialect() } models loaded`)
        }

        return sequelize
    })
    .catch(err => {
        if (!options.silent) {
            console.error('Unable to connect to the database:', err)
        }

        throw (err)
    })

    return connectionPromise
}

type DefineAttribute = string | Sequelize.DataTypeAbstract | Sequelize.DefineAttributeColumnOptions

export function property(defineAttribute: DefineAttribute) {
    if (!defineAttribute) {
        throw Error('defineAttribute must be defined')
    }

    // if (!defineAttribute.type) {
    // 	throw Error('Sequelize type must be defined')
    // }

    return (target, name) => {
        // Note: This is a workaround due to a similar bug described here:
        // https://stackoverflow.com/questions/43912168/typescript-decorators-with-inheritance

        if (!Object.getOwnPropertyDescriptor(target, '_sqtMetadata')) {
            target._sqtMetadata = {}
        }

        if (target._sqtMetadata.properties) {
            target._sqtMetadata.properties[name] = defineAttribute
        } else {
            target._sqtMetadata.properties = { [name]: defineAttribute }
        }

        const parentTarget = Object.getPrototypeOf(target)
        const parentData = parentTarget._sqtMetadata

        if (parentData) {
            if (parentData.properties) {
                Object.keys(parentData.properties).forEach((key) => {
                    if (!target._sqtMetadata.properties[key]) {
                        target._sqtMetadata.properties[key] = parentData.properties[key]
                    }
                })
            }
        }
    }
}
