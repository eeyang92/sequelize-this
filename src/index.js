import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'
import isEqual from 'lodash.isequal'

export var connection = null

var connectionPromise = null

function isAttribute(obj, dialect) {
	if (Sequelize.DataTypes.hasOwnProperty(obj.key)) {
		return true
	} else if (Sequelize.DataTypes[dialect].hasOwnProperty(obj.key)) {
		return true
	}

	return false
}

function extractPropsFromClassDefinition(obj, dialect) {
	let props = {
		methods: {},
		staticMethods: {},
		attributes: {},
		staticAttributes: {},
		relationships: []
	}

	const usedNames = new Set()

	// if (obj.constructor._sqtMetadata) {
	// 	if (obj.constructor._sqtMetadata.relationships) {
	// 		// getNonIntersectingElementsOnFirstArray(obj.constructor._sqtMetadata.relationships, props.relationships)
	// 		// .forEach((relationship) => {
	// 		// 	props.relationships.push(relationship)
	// 		// })
	// 		props.relationships = obj.constructor._sqtMetadata.relationships

	// 		console.log('propsrel:', props.relationships)
	// 		// Object.assign(props.relationships, obj.constructor._sqtMetadata.relationships)
	// 	}
	// }

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
	
				if (typeof pValue === 'function'
					&& !isAttribute(pValue, dialect)
				) {
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
				getNonIntersectingElementsOnFirstArray(obj._sqtMetadata.relationships, props.relationships)
				.forEach((relationship) => {
					props.relationships.push(relationship)
				})
				// props.relationships = obj.constructor._sqtMetadata.relationships

				// console.log('propsrel:', props.relationships)
				// Object.assign(props.relationships, obj.constructor._sqtMetadata.relationships)
			}
		}
	}
	while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj))

	return props
}

export function classToSequelizeSchema(classDefinition, nameOverride, options) {
	return function(sequelize: Object) {
		const props = extractPropsFromClassDefinition(classDefinition, sequelize.getDialect())

		const schema = sequelize.define(
			(nameOverride) ? nameOverride : classDefinition.name,
			props.attributes,
			options
		)

		if (props.relationships) {
			schema.associate = (_sequelize) => {
				props.relationships.forEach((relationship) => {
					setRelationship(schema, relationship.relationshipType, _sequelize.models[relationship.targetClass], relationship.options, relationship.overrideOptions)
				})
				// for (const key in props.relationships) {
				// 	if (props.relationships.hasOwnProperty(key)) {
				// 		const relationship = props.relationships[key]

				// 		setRelationship(schema, relationship.relationshipType, _sequelize.models[relationship.targetClass], relationship.options)
				// 	}
				// }
			}
		}

		if (classDefinition.modifySchema) {
			schema.modifySchema = classDefinition.modifySchema(schema)
		}

		Object.assign(schema, props.staticMethods)
		Object.assign(schema.prototype, props.methods)

		return schema
	}
}

export function setConnection(sequelize) {
	connection = sequelize
}

export function getConnection() {
	if (connectionPromise) {
		return connectionPromise
		.then(() => {
			return connection
		})
	} else {
		throw Error('Sequlize connection was never initiated')
	}
}

function importFiles(sequelize_, schemaDir_) { // Note: Not tested against symlinks, avoid infinite loops?
	const db = {}
	const filesToImport = []
	const directoriesToScan = [schemaDir_]

	while (directoriesToScan.length > 0) {
		const directory = directoriesToScan.pop()

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

	filesToImport
	.filter((file) => {
		const filename = file.split(/\/|\\/).pop()

		return (filename.indexOf('.') !== 0) && (filename.split('.').pop() === 'js')
	})
	.forEach((file) => {
		const model = sequelize_.import(file)
		
		db[model.name] = model
	})

	return db
}

export function initializeSequelize(sequelize, schemaDir) {
	if (!schemaDir) {
		throw Error('Need a schema dir!')
	}

	console.log('Initializing connection...')

	connectionPromise = sequelize
	.authenticate()
	.then(() => {
		console.log(`--> connection to ${ sequelize.getDialect() } database established`)

		// const db = {}

		// fs.readdirSync(schemaDir)
		// .filter((file) => {
		// 	return (file.indexOf('.') !== 0) && (file.split('.').pop() === 'js')
		// })
		// .forEach((file) => {
		// 	const model = sequelize.import(path.join(schemaDir, file))

		// 	db[model.name] = model
		// })

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

		console.log(`--> ${ sequelize.getDialect() } models loaded`)

		return
	})
	.catch(err => {
		console.error('Unable to connect to the database:', err)
	})

	return connectionPromise
}

const validRelationshipTypes = ['hasOne', 'hasMany', 'belongsTo', 'belongsToMany']

function setRelationship(schema, relationshipType, model, options, overrideOptions) {
	const newOptions = (options) ? Object.assign({}, options) : {}

	if (overrideOptions) {
		Object.keys(overrideOptions).forEach((key) => {
			newOptions[key] = overrideOptions[key](schema)
		})
	}

	if (validRelationshipTypes.includes(relationshipType)) {
		schema[relationshipType](model, newOptions)
	} else {
		throw Error('Invalid relationship type')
	}
}

function getNonIntersectingElementsOnFirstArray(array1, array2) {
	return array1.filter((element1) => {
		if (array2.length === 0) {
			return true
		}

		return array2.some((element2) => {
			return !isEqual(element2, element1)
		})
	})
}

export function relationship(relationshipType, targetClass, options, overrideOptions) {
	if (!relationshipType) {
		throw Error('Relationship Type must be defined')
	}

	if (!validRelationshipTypes.includes(relationshipType)) {
		throw Error('Invalid relationship type') 
	}

	if (!targetClass) {
		throw Error('Target Class must be defined')
	}

	return (target) => {
		// Note: This is a workaround due to a similar bug described here:
		// https://stackoverflow.com/questions/43912168/typescript-decorators-with-inheritance

		// let name = targetClass

		// if (options) {
		// 	if (options.foreignKey) {
		// 		name = options.foreignKey
		// 	}

		// 	if (options.as) {
		// 		name = options.as
		// 	}
		// }

		if (!Object.getOwnPropertyDescriptor(target, '_sqtMetadata')) {
			target._sqtMetadata = {}
		}

		if (target._sqtMetadata.relationships) {
			target._sqtMetadata.relationships.push({
				relationshipType,
				targetClass,
				options,
				overrideOptions
			})
		} else {
			target._sqtMetadata.relationships = [{
				relationshipType,
				targetClass,
				options,
				overrideOptions
			}]
		}

		// Note: This part is not needed as extractPropsFromClassDefinition
		// will walk through the parent

		// const parentTarget = Object.getPrototypeOf(target)
		// const parentData = parentTarget._sqtMetadata

		// if (parentData) {
		// 	if (parentData.relationships) {
		// 		getNonIntersectingElementsOnFirstArray(parentData.relationships, target._sqtMetadata.relationships)
		// 		// parentData.relationships.filter((parentRelationship) => {
		// 		// 	return target._sqtMetadata.relationships.some((relationship) => {
		// 		// 		return !isEqual(relationship, parentRelationship)
		// 		// 	})
		// 		// })
		// 		.forEach((relationship) => {
		// 			target._sqtMetadata.relationships.push(relationship)
		// 		})

		// 		// Object.keys(parentData.relationships).forEach((key) => {
		// 		// 	if (!target._sqtMetadata.relationships[key]) {
		// 		// 		target._sqtMetadata.relationships[key] = parentData.relationships[key]
		// 		// 	}
		// 		// })
		// 	}
		// }

		// if (target._sqtMetadata) {
		// 	if (target._sqtMetadata.relationships) {
		// 		target._sqtMetadata.relationships[name] = {
		// 			relationshipType,
		// 			targetClass,
		// 			options
		// 		}
		// 	} else {
		// 		target._sqtMetadata.relationships = {
		// 			[name]: {
		// 				relationshipType,
		// 				targetClass,
		// 				options
		// 			}
		// 		}
		// 	}
		// } else {
		// 	target._sqtMetadata = {
		// 		relationships: {
		// 			[name]: {
		// 				relationshipType,
		// 				targetClass,
		// 				options
		// 			}
		// 		}
		// 	}
		// }
	}
}

// export function relationship(relationshipType, targetClass, options) {
// 	return (target) => {
// 		if (target.modifySchema) {
// 			const oldModifySchema = target.modifySchema.bind(this)

// 			target.modifySchema = (schema) => {
// 				const oldFunc = oldModifySchema(schema)

// 				return (sequelize) => {
// 					oldFunc(sequelize)

// 					setRelationship(schema, relationshipType, sequelize.models[targetClass], options)
// 				}
// 			}
// 		} else {
// 			target.modifySchema = (schema) => {
// 				return (sequelize) => {
// 					setRelationship(schema, relationshipType, sequelize.models[targetClass], options)
// 				}
// 			}
// 		}
// 	}
// }

export function hasOne(targetClass, options, overrideOptions) {
	return relationship('hasOne', targetClass, options, overrideOptions)
}

export function hasMany(targetClass, options, overrideOptions) {
	return relationship('hasMany', targetClass, options, overrideOptions)
}

export function belongsTo(targetClass, options, overrideOptions) {
	return relationship('belongsTo', targetClass, options, overrideOptions)
}

export function belongsToMany(targetClass, options, overrideOptions) {
	return relationship('belongsToMany', targetClass, options, overrideOptions)
}

export function camelCase(string) {
	return string.charAt(0).toLowerCase() + string.slice(1)
}

export function property(options) {
	if (!options) {
		throw Error('Options must be defined')
	}

	if (!options.type) {
		throw Error('Sequelize type must be defined')
	}

	return (target, name) => {
		// Note: This is a workaround due to a similar bug described here:
		// https://stackoverflow.com/questions/43912168/typescript-decorators-with-inheritance

		if (!Object.getOwnPropertyDescriptor(target, '_sqtMetadata')) {
			target._sqtMetadata = {}
		}

		if (target._sqtMetadata.properties) {
			target._sqtMetadata.properties[name] = options.type
		} else {
			target._sqtMetadata.properties = { [name]: options.type }
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
