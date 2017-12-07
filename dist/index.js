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

var _lodash = require('lodash.isequal');

var _lodash2 = _interopRequireDefault(_lodash);

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

function extractPropsFromClassDefinition(obj, dialect) {
	var props = {
		methods: {},
		staticMethods: {},
		attributes: {},
		staticAttributes: {},
		relationships: []
	};

	var usedNames = new Set();

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
			var tempStatics = Object.getOwnPropertyNames(obj.prototype.constructor).filter(function (value) {
				return value !== 'length' && value !== 'name' && value !== 'prototype' && !usedNames.has(value);
			});

			tempStatics.forEach(function (value) {
				if (value !== 'modifySchema') {
					var pValue = obj.prototype.constructor[value];

					if (typeof pValue === 'function') {
						props.staticMethods[value] = pValue;
					} else {
						props.staticAttributes[value] = pValue;
					}

					usedNames.add(value);
				}
			});

			var temp = Object.getOwnPropertyNames(obj.prototype).concat(Object.getOwnPropertySymbols(obj.prototype).map(function (s) {
				return s.toString();
			})).filter(function (value, i, arr) {
				return value !== 'constructor' && value !== 'modifySchema' && value !== 'sequelize' && value !== '_sqtMetadata' && (i == 0 || value !== arr[i - 1]) && !usedNames.has(value);
			});

			temp.forEach(function (value) {
				var pValue = obj.prototype[value];

				if (typeof pValue === 'function' && !isAttribute(pValue, dialect)) {
					props.methods[value] = pValue;
				} else {
					props.attributes[value] = pValue;
				}

				usedNames.add(value);
			});

			if (obj.prototype._sqtMetadata) {
				if (obj.prototype._sqtMetadata.properties) {
					Object.assign(props.attributes, obj.prototype._sqtMetadata.properties);
				}
			}
		}

		if (obj._sqtMetadata) {
			if (obj._sqtMetadata.relationships) {
				getNonIntersectingElementsOnFirstArray(obj._sqtMetadata.relationships, props.relationships).forEach(function (relationship) {
					props.relationships.push(relationship);
				});
				// props.relationships = obj.constructor._sqtMetadata.relationships

				// console.log('propsrel:', props.relationships)
				// Object.assign(props.relationships, obj.constructor._sqtMetadata.relationships)
			}
		}
	} while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj));

	return props;
}

function classToSequelizeSchema(classDefinition, nameOverride, options) {
	return function (sequelize) {
		var props = extractPropsFromClassDefinition(classDefinition, sequelize.getDialect());

		var schema = sequelize.define(nameOverride ? nameOverride : classDefinition.name, props.attributes, options);

		if (props.relationships) {
			schema.associate = function (_sequelize) {
				props.relationships.forEach(function (relationship) {
					setRelationship(schema, relationship.relationshipType, _sequelize.models[relationship.targetClass], relationship.options, relationship.overrideOptions);
				});
				// for (const key in props.relationships) {
				// 	if (props.relationships.hasOwnProperty(key)) {
				// 		const relationship = props.relationships[key]

				// 		setRelationship(schema, relationship.relationshipType, _sequelize.models[relationship.targetClass], relationship.options)
				// 	}
				// }
			};
		}

		if (classDefinition.modifySchema) {
			schema.modifySchema = classDefinition.modifySchema(schema);
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

function importFiles(sequelize_, schemaDir_) {
	// Note: Not tested against symlinks, avoid infinite loops?
	var db = {};
	var filesToImport = [];
	var directoriesToScan = [schemaDir_];

	var _loop = function _loop() {
		var directory = directoriesToScan.pop();

		_fs2.default.readdirSync(directory).forEach(function (file) {
			var absolutePath = _path2.default.join(directory, file);
			var stats = _fs2.default.statSync(absolutePath);

			if (stats.isDirectory()) {
				directoriesToScan.push(absolutePath);
			} else {
				filesToImport.push(absolutePath);
			}
		});
	};

	while (directoriesToScan.length > 0) {
		_loop();
	}

	filesToImport.filter(function (file) {
		var filename = file.split(/\/|\\/).pop();

		return filename.indexOf('.') !== 0 && filename.split('.').pop() === 'js';
	}).forEach(function (file) {
		var model = sequelize_.import(file);

		db[model.name] = model;
	});

	return db;
}

function initializeSequelize(sequelize, schemaDir) {
	if (!schemaDir) {
		throw Error('Need a schema dir!');
	}

	console.log('Initializing connection...');

	connectionPromise = sequelize.authenticate().then(function () {
		console.log('--> connection to ' + sequelize.getDialect() + ' database established');

		// const db = {}

		// fs.readdirSync(schemaDir)
		// .filter((file) => {
		// 	return (file.indexOf('.') !== 0) && (file.split('.').pop() === 'js')
		// })
		// .forEach((file) => {
		// 	const model = sequelize.import(path.join(schemaDir, file))

		// 	db[model.name] = model
		// })

		var db = importFiles(sequelize, schemaDir);

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

function setRelationship(schema, relationshipType, model, options, overrideOptions) {
	var newOptions = options ? Object.assign({}, options) : {};

	if (overrideOptions) {
		Object.keys(overrideOptions).forEach(function (key) {
			newOptions[key] = overrideOptions[key](schema);
		});
	}

	if (validRelationshipTypes.includes(relationshipType)) {
		schema[relationshipType](model, newOptions);
	} else {
		throw Error('Invalid relationship type');
	}
}

function getNonIntersectingElementsOnFirstArray(array1, array2) {
	return array1.filter(function (element1) {
		if (array2.length === 0) {
			return true;
		}

		return array2.some(function (element2) {
			return !(0, _lodash2.default)(element2, element1);
		});
	});
}

function relationship(relationshipType, targetClass, options, overrideOptions) {
	if (!relationshipType) {
		throw Error('Relationship Type must be defined');
	}

	if (!validRelationshipTypes.includes(relationshipType)) {
		throw Error('Invalid relationship type');
	}

	if (!targetClass) {
		throw Error('Target Class must be defined');
	}

	return function (target) {
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
			target._sqtMetadata = {};
		}

		if (target._sqtMetadata.relationships) {
			target._sqtMetadata.relationships.push({
				relationshipType: relationshipType,
				targetClass: targetClass,
				options: options,
				overrideOptions: overrideOptions
			});
		} else {
			target._sqtMetadata.relationships = [{
				relationshipType: relationshipType,
				targetClass: targetClass,
				options: options,
				overrideOptions: overrideOptions
			}];
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

function hasOne(targetClass, options, overrideOptions) {
	return relationship('hasOne', targetClass, options, overrideOptions);
}

function hasMany(targetClass, options, overrideOptions) {
	return relationship('hasMany', targetClass, options, overrideOptions);
}

function belongsTo(targetClass, options, overrideOptions) {
	return relationship('belongsTo', targetClass, options, overrideOptions);
}

function belongsToMany(targetClass, options, overrideOptions) {
	return relationship('belongsToMany', targetClass, options, overrideOptions);
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
	};
}

