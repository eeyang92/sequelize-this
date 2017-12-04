'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.connection = undefined;
exports.classToSequelizeSchema = classToSequelizeSchema;
exports.setConnection = setConnection;
exports.getConnection = getConnection;
exports.initializeSequelize = initializeSequelize;
exports.relationship = relationship;
exports.hasOne = hasOne;
exports.hasMany = hasMany;
exports.belongsTo = belongsTo;
exports.belongsToMany = belongsToMany;
exports.camelCase = camelCase;
exports.property = property;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sequelize2 = require('sequelize');

var _sequelize3 = _interopRequireDefault(_sequelize2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var connection = exports.connection = null;

var connectionPromise = null;

function isAttribute(obj, dialect) {
	if (_sequelize3.default.DataTypes.hasOwnProperty(obj.key)) {
		return true;
	} else if (_sequelize3.default.DataTypes[dialect].hasOwnProperty(obj.key)) {
		return true;
	}

	return false;
}

function extractPropsFromClassInstance(obj, dialect) {
	var props = {
		methods: {},
		staticMethods: {},
		attributes: {},
		staticAttributes: {},
		relationships: {}
	};

	var usedNames = new Set();

	do {
		var tempStatics = Object.getOwnPropertyNames(obj.constructor).filter(function (value) {
			return value !== 'length' && value !== 'name' && value !== 'prototype' && !usedNames.has(value);
		});

		tempStatics.forEach(function (value) {
			if (value !== 'modifySchema') {
				var pValue = obj.constructor[value];

				if (typeof pValue === 'function') {
					props.staticMethods[value] = pValue;
				} else {
					props.staticAttributes[value] = pValue;
				}

				usedNames.add(value);
			}
		});

		var temp = Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj).map(function (s) {
			return s.toString();
		})).filter(function (value, i, arr) {
			return value !== 'constructor' && value !== 'modifySchema' && value !== 'sequelize' && value !== '_sqtMetadata' && (i == 0 || value !== arr[i - 1]) && !usedNames.has(value);
		});

		temp.forEach(function (value) {
			var pValue = obj[value];

			if (typeof pValue === 'function' && !isAttribute(pValue, dialect)) {
				props.methods[value] = pValue;
			} else {
				props.attributes[value] = pValue;
			}

			usedNames.add(value);
		});

		if (obj._sqtMetadata) {
			if (obj._sqtMetadata.properties) {
				Object.assign(props.attributes, obj._sqtMetadata.properties);
			}
		}

		if (obj.constructor._sqtMetadata) {
			if (obj.constructor._sqtMetadata.relationships) {
				Object.assign(props.relationships, obj.constructor._sqtMetadata.relationships);
			}
		}
	} while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj));

	return props;
}

function classToSequelizeSchema(classInstance, nameOverride, options) {
	return function (sequelize) {
		var props = extractPropsFromClassInstance(classInstance, sequelize.getDialect());

		var schema = sequelize.define(nameOverride ? nameOverride : classInstance.constructor.name, props.attributes, options);

		if (props.relationships) {
			schema.associate = function (_sequelize) {
				for (var key in props.relationships) {
					if (props.relationships.hasOwnProperty(key)) {
						var _relationship = props.relationships[key];

						setRelationship(schema, _relationship.relationshipType, _sequelize.models[_relationship.targetClass], _relationship.options);
					}
				}
			};
		}

		if (classInstance.constructor.modifySchema) {
			schema.modifySchema = classInstance.constructor.modifySchema(schema);
		}

		Object.assign(schema, props.staticMethods);
		Object.assign(schema.prototype, props.methods);

		return schema;
	};
}

function setConnection(sequelize) {
	exports.connection = connection = sequelize;
}

function getConnection() {
	if (connectionPromise) {
		return connectionPromise.then(function () {
			return connection;
		});
	} else {
		throw Error('Sequlize connection was never initiated');
	}
}

function initializeSequelize(sequelize, schemaDir) {
	if (!schemaDir) {
		throw Error('Need a schema dir!');
	}

	console.log('Initializing connection...');

	connectionPromise = sequelize.authenticate().then(function () {
		console.log('--> connection to ' + sequelize.getDialect() + ' database established');

		var db = {};

		_fs2.default.readdirSync(schemaDir).filter(function (file) {
			return file.indexOf('.') !== 0 && file.split('.').pop() === 'js';
		}).forEach(function (file) {
			var model = sequelize.import(_path2.default.join(schemaDir, file));

			db[model.name] = model;
		});

		Object.keys(db).forEach(function (modelName) {
			if (db[modelName].hasOwnProperty('modifySchema')) {
				db[modelName].modifySchema(sequelize);
			}

			if (db[modelName].hasOwnProperty('associate')) {
				db[modelName].associate(sequelize);
			}
		});

		exports.connection = connection = sequelize;

		console.log('--> ' + sequelize.getDialect() + ' models loaded');

		return;
	}).catch(function (err) {
		console.error('Unable to connect to the database:', err);
	});

	return connectionPromise;
}

var validRelationshipTypes = ['hasOne', 'hasMany', 'belongsTo', 'belongsToMany'];

function setRelationship(schema, relationshipType, model, options) {
	if (validRelationshipTypes.includes(relationshipType)) {
		schema[relationshipType](model, options);
	} else {
		throw Error('Invalid relationship type');
	}
}

function relationship(relationshipType, targetClass, options) {
	if (!relationshipType) {
		throw Error('Relationship Type must be defined');
	}

	if (!validRelationshipTypes.includes(relationshipType)) {
		throw Error('Invalid relationship type');
	}

	if (!targetClass) {
		throw Error('Target Class must be defined');
	}

	var name = targetClass;

	if (options) {
		if (options.foreignKey) {
			name = options.foreignKey;
		}
	}

	return function (target) {
		// Note: This is a workaround due to a similar bug described here:
		// https://stackoverflow.com/questions/43912168/typescript-decorators-with-inheritance

		if (!Object.getOwnPropertyDescriptor(target, '_sqtMetadata')) {
			target._sqtMetadata = {};
		}

		if (target._sqtMetadata.relationships) {
			target._sqtMetadata.relationships[name] = {
				relationshipType: relationshipType,
				targetClass: targetClass,
				options: options
			};
		} else {
			target._sqtMetadata.relationships = _defineProperty({}, name, {
				relationshipType: relationshipType,
				targetClass: targetClass,
				options: options
			});
		}

		var parentTarget = Object.getPrototypeOf(target);
		var parentData = parentTarget._sqtMetadata;

		if (parentData) {
			if (parentData.relationships) {
				Object.keys(parentData.relationships).forEach(function (key) {
					if (!target._sqtMetadata.relationships[key]) {
						target._sqtMetadata.relationships[key] = parentData.relationships[key];
					}
				});
			}
		}

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
	};
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

function hasOne(targetClass, options) {
	return relationship('hasOne', targetClass, options);
}

function hasMany(targetClass, options) {
	return relationship('hasMany', targetClass, options);
}

function belongsTo(targetClass, options) {
	return relationship('belongsTo', targetClass, options);
}

function belongsToMany(targetClass, options) {
	return relationship('belongsToMany', targetClass, options);
}

function camelCase(string) {
	return string.charAt(0).toLowerCase() + string.slice(1);
}

function property(options) {
	if (!options) {
		throw Error('Options must be defined');
	}

	if (!options.type) {
		throw Error('Sequelize type must be defined');
	}

	return function (target, name) {
		// Note: This is a workaround due to a similar bug described here:
		// https://stackoverflow.com/questions/43912168/typescript-decorators-with-inheritance

		if (!Object.getOwnPropertyDescriptor(target, '_sqtMetadata')) {
			target._sqtMetadata = {};
		}

		if (target._sqtMetadata.properties) {
			target._sqtMetadata.properties[name] = options.type;
		} else {
			target._sqtMetadata.properties = _defineProperty({}, name, options.type);
		}

		var parentTarget = Object.getPrototypeOf(target);
		var parentData = parentTarget._sqtMetadata;

		if (parentData) {
			if (parentData.properties) {
				Object.keys(parentData.properties).forEach(function (key) {
					if (!target._sqtMetadata.properties[key]) {
						target._sqtMetadata.properties[key] = parentData.properties[key];
					}
				});
			}
		}
		// console.log(target)

		// // if (target.hasOwnProperty('_sqtMetaData')) {
		// // 	console.log('has sqt!')
		// // }

		// if (target.constructor._sqtMetadata) {
		// 	if (target.constructor._sqtMetadata.properties) {
		// 		target.constructor._sqtMetadata.properties[name] = options.type
		// 	} else {
		// 		target.constructor._sqtMetadata.properties = { [name]: options.type }
		// 	}
		// } else {
		// 	target.constructor._sqtMetadata = {
		// 		properties: {
		// 			[name]: options.type
		// 		}
		// 	}
		// }
	};
}

