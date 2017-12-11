import * as Sequelize from 'sequelize'

const validRelationshipTypes = ['hasOne', 'hasMany', 'belongsTo', 'belongsToMany']

export function setRelationship(schema: Sequelize.Model<any, any>, relationshipType: string, model: Sequelize.Model<any, any>, options: Sequelize.AssociationOptions, overrideOptions) {
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

export function relationship(relationshipType: string, targetClass: string, options: Sequelize.AssociationOptions, overrideOptions) {
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
	}
}

export function hasOne(targetClass: string, options: Sequelize.AssociationOptions, overrideOptions) {
	return relationship('hasOne', targetClass, options, overrideOptions)
}

export function hasMany(targetClass: string, options: Sequelize.AssociationOptions, overrideOptions) {
	return relationship('hasMany', targetClass, options, overrideOptions)
}

export function belongsTo(targetClass: string, options: Sequelize.AssociationOptions, overrideOptions) {
	return relationship('belongsTo', targetClass, options, overrideOptions)
}

export function belongsToMany(targetClass: string, options: Sequelize.AssociationOptions, overrideOptions) {
	return relationship('belongsToMany', targetClass, options, overrideOptions)
}

export default {
	hasOne, hasMany, belongsTo, belongsToMany, relationship
}
