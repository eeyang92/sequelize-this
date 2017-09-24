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

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sequelize = require('sequelize');

var _sequelize2 = _interopRequireDefault(_sequelize);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var connection = exports.connection = null;

var connectionPromise = null;

function isAttribute(obj, dialect) {
	if (_sequelize2.default.DataTypes.hasOwnProperty(obj.key)) {
		return true;
	} else if (_sequelize2.default.DataTypes[dialect].hasOwnProperty(obj.key)) {
		return true;
	}

	return false;
}

function extractPropsFromClassInstance(obj, dialect) {
	var props = {
		methods: {},
		staticMethods: {},
		attributes: {},
		staticAttributes: {}
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
			return value !== 'constructor' && value !== 'modifySchema' && value !== 'sequelize' && (i == 0 || value !== arr[i - 1]) && !usedNames.has(value);
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
	} while ((obj = Object.getPrototypeOf(obj)) && Object.getPrototypeOf(obj));

	return props;
}

function classToSequelizeSchema(classInstance) {
	var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	var nameOverride = options.nameOverride;

	return function (sequelize) {
		var props = extractPropsFromClassInstance(classInstance, sequelize.getDialect());

		var schema = sequelize.define(nameOverride ? nameOverride : classInstance.constructor.name, props.attributes);

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
	var _this = this;

	return function (target) {
		if (target.modifySchema) {
			var oldModifySchema = target.modifySchema.bind(_this);

			target.modifySchema = function (schema) {
				var oldFunc = oldModifySchema(schema);

				return function (sequelize) {
					oldFunc(sequelize);

					setRelationship(schema, relationshipType, sequelize.models[targetClass], options);
				};
			};
		} else {
			target.modifySchema = function (schema) {
				return function (sequelize) {
					setRelationship(schema, relationshipType, sequelize.models[targetClass], options);
				};
			};
		}
	};
}

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

