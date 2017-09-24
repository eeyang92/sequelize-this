## Installation

```sh
npm install --save sequelize-this
```

or

```sh
yarn add sequelize-this
```

## Purpose of this Package

Utility functions for Sequelize

Note: This package was created to assist me in my projects, as such the features included may not be as cohesive as other packages. It was also created with MySQL in mind, but should work for any of the supported dialects. If you have any feature requests or suggestions, feel free to open an issue on the repo.

## API

- `classToSequelizeSchema(classInstance, options): function(sequelize): Schema`
	- Converts a regular Javascript Class instance into a Sequelize Schema **Function**, that can then be used to generate the Sequelize Schema upon initialization
	- Example (with decorators):
		```javascript
		import Sequelize from 'sequelize'

		@hasMany('Comment')
		class User {
			name = Sequelize.STRING
		}

		export default classToSequelizeSchema(new User())
		```
	- Example (without decorators):
		```javascript
		import Sequelize from 'sequelize'

		class User {
			name = Sequelize.STRING

			static modifySchema(schema) {
				return (sequelize) => {
					schema.hasMany(sequelize.models.Comment)
				}
			}

		}

		export default classToSequelizeSchema(new User())
		```
	- Note: Instead of a method called `associate` there is a method called `modifySchema`, since you can do anything to the schema object in this method. This is relevant if you wish to initialize Sequelize yourself, instead of using the provided `initializeSequelize` function

- `initializeSequelize(sequelize, schemaDir): Promise`
	- Currently does not support subdirectories (TODO)
	- Allow support for custom filters for model files (TODO)
	- Will load all .js files in the defined schema directory
		- Import strategy follows the guideline set in the Sequelize docs: [http://sequelize.readthedocs.io/en/1.7.0/articles/express/]()
	- Will set an exportable singleton variable called `connection` that you can import from any file
	- Returns a promise once all schemas are loaded
	- Example:
		```javascript
		import express from 'express'
		import Sequelize from 'sequelize'
		import { initializeSequelize } from 'sequelize-this'

		const app = express()

		app.use('/', myRoutes)

		const port = process.env.PORT || 9000

		const sequelize = new Sequelize('dbname', 'user', 'password', {
			host: 'localhost',
			dialect: 'mysql',
			pool: {
				max: 10,
				min: 0,
				idle: 10000
			},
			logging: false
		})

		initializeSequelize(sequelize, __dirname + '/../common/mysql_schema')
		.then(() => sequelize.sync())
		.then(() => {
			app.listen(port, () => {
				console.log(`API Server listening on port ${port}!`)
			})
		})
		```

- `setConnection(sequelize)`
	- If you wish to initialize Sequelize yourself instead of using `initializeSequelize`, but still want to use the singleton pattern, you can set the `connection` variable using this method and use `connection` normally

- `getConnection(): Promise(connection)`
	- Returns when all schemas are loaded and `connection` is set
	- Throws an error if `initializeSequelize` was never run

- `connection`
	- Singleton variable holding the sequelize instance
	- Use this to retrieve the value synchronously if you know `connection` will be set by the time this variable is used

- `relationship(relationshipType, targetClass, options)`
	- Use this to decorate a class to set a relationship
	- Valid types: `'hasOne', 'hasMany', 'belongsTo', 'belongsToMany'`

- `hasOne(targetClass, options)`
	- Wrapper for `relationship('hasOne`, targetClass, options)`

- `hasMany(targetClass, options)`
	- Wrapper for `relationship('hasMany`, targetClass, options)`

- `belongsTo(targetClass, options)`
	- Wrapper for `relationship('belongsTo`, targetClass, options)`

- `belongsToMany(targetClass, options)`
	- Wrapper for `relationship('belongsToMany`, targetClass, options)`
