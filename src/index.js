import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

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

function extractPropsFromClassInstance(obj, dialect) {
	let props = {
		methods: {},
		staticMethods: {},
		attributes: {},
		staticAttributes: {}
	}

	const usedNames = new Set()

	do {
		const tempStatics = Object.getOwnPropertyNames(obj.constructor).filter((value) =>
			value !== 'length' && value !== 'name' && value !== 'prototype' &&
			!usedNames.has(value)
		)

		tempStatics.forEach((value) => {
			if (value !== 'modifySchema') {
				const pValue = obj.constructor[value]

				if (typeof pValue === 'function') {
					props.staticMethods[value] = pValue
				} else {
					props.staticAttributes[value] = pValue
				}

				usedNames.add(value)
			}
		})

		const temp = Object.getOwnPropertyNames(obj)
		.concat(Object.getOwnPropertySymbols(obj).map(s => s.toString()))
		.filter((value, i, arr) =>
			value !== 'constructor' &&
			value !== 'modifySchema' &&
			value !== 'sequelize' &&
			(i == 0 || value !== arr[i - 1]) &&
			!usedNames.has(value)
		)

		temp.forEach((value) => {
			const pValue = obj[value]

			if (typeof pValue === 'function'
				&& !isAttribute(pValue, dialect)
			) {
				props.methods[value] = pValue
			} else {
				props.attributes[value] = pValue
			}

			usedNames.add(value)
		})
	}
	while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj))

	return props
}

export function classToSequelizeSchema(classInstance, options = {}) {
	const nameOverride = options.nameOverride

	return function(sequelize: Object) {
		const props = extractPropsFromClassInstance(classInstance, sequelize.getDialect())

		const schema = sequelize.define(
			(nameOverride) ? nameOverride : classInstance.constructor.name,
			props.attributes
		)

		if (classInstance.constructor.modifySchema) {
			schema.modifySchema = classInstance.constructor.modifySchema(schema)
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

export function initializeSequelize(sequelize, schemaDir) {
	if (!schemaDir) {
		throw Error('Need a schema dir!')
	}

	console.log('Initializing connection...')

	connectionPromise = sequelize
	.authenticate()
	.then(() => {
		console.log(`--> connection to ${ sequelize.getDialect() } database established`)

		const db = {}

		fs.readdirSync(schemaDir)
		.filter((file) => {
			return (file.indexOf('.') !== 0) && (file.split('.').pop() === 'js')
		})
		.forEach((file) => {
			const model = sequelize.import(path.join(schemaDir, file))

			db[model.name] = model
		})

		Object.keys(db).forEach((modelName) => {
			if (db[modelName].hasOwnProperty('modifySchema')) {
				db[modelName].modifySchema(sequelize)
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

function setRelationship(schema, relationshipType, model, options) {
	if (validRelationshipTypes.includes(relationshipType)) {
		schema[relationshipType](model, options)
	} else {
		throw Error('Invalid relationship type')
	}
}

export function relationship(relationshipType, targetClass, options) {
	return (target) => {
		if (target.modifySchema) {
			const oldModifySchema = target.modifySchema.bind(this)

			target.modifySchema = (schema) => {
				const oldFunc = oldModifySchema(schema)

				return (sequelize) => {
					oldFunc(sequelize)

					setRelationship(schema, relationshipType, sequelize.models[targetClass], options)
				}
			}
		} else {
			target.modifySchema = (schema) => {
				return (sequelize) => {
					setRelationship(schema, relationshipType, sequelize.models[targetClass], options)
				}
			}
		}
	}
}

export function hasOne(targetClass, options) {
	return relationship('hasOne', targetClass, options)
}

export function hasMany(targetClass, options) {
	return relationship('hasMany', targetClass, options)
}

export function belongsTo(targetClass, options) {
	return relationship('belongsTo', targetClass, options)
}

export function belongsToMany(targetClass, options) {
	return relationship('belongsToMany', targetClass, options)
}
