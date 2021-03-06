## Installation

```sh
npm install --save sequelize-this
```

or

```sh
yarn add sequelize-this
```

The latest beta build

```sh
yarn add sequelize-this@beta
```

Test

```sh
npm install sequelize
npm run test
```

- Note: `sequelize` is listed a peer dependency, which may not be installed automatically

## Purpose of this Package

Utility functions for Sequelize

Note: This package was created to assist me in my projects, as such the features included may not be as cohesive as other packages. It was also created with MySQL in mind, but should work for any of the supported dialects. If you have any feature requests or suggestions, feel free to open an issue.

## API

## `sequelize-this`

### `classToSequelizeSchema(classDefinition, options: Sequelize.DefineOptions<any> = {}, sqtOptions: SqtOptions = {}): function(sequelize: Sequelize): Sequelize.Model`
- Converts a regular Javascript Class instance into a Sequelize Schema **function**, that can then be used to generate the Sequelize Schema upon initialization
- If `nameOverride` is `undefined` (or any equivalent to `false`), then the class name is used
- `options` is passed into `schema.define`
- Known Issue: instance/class methods must be defined as a method, and not as a property on a class (as shown below)
- Example:
    ```javascript
    import Sequelize from 'sequelize'
    import { classToSequelizeSchema, property } from 'sequelize-this'
    import { hasMany } from 'sequelize-this/relationships'

    class Base {
        @property({
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        })
        id
    }

    @hasMany('Comment')
    class User extends Base {
        @property({ type: Sequelize.STRING })
        name

        doSomethingWithUser() {
            ...
        }
    }

    export default classToSequelizeSchema(User)
    ```
- Note: User will have the property `id` via inheritance
    - All relationships and properties are inherited
    - (WIP) Custom logic to find subclasses if performing a `find()` or `findAll()` on a superclass
- Note: Support for usage without decorators is no longer provided
- Instead of a method called `associate`, you can define a static method called `modifySchema`, since you can do anything to the schema object in this method. This is relevant if you wish to initialize Sequelize yourself, instead of using the provided `initializeSequelize` function
    - Format of `modifySchema` method:
        ```javascript
            static modifySchema(schema) {
                return (sequelize) => {
                    schema.hasMany(sequelize.models.Comment)
                }
            }
        ```
    - In fact, a method called `associate` is indeed created behind the scenes, but this may change in the future

### `SqtOptions`
- `nameOverride`: `string`

### `initializeSequelize(sequelize: Sequelize, schemaDir: string, options: InitializeSequelizeOptions = {}): Promise<Sequelize.Sequelize>`
- Allow support for custom filters for model files (TODO)
- Will load all .js files in the defined schema directory (and subdirectories)
    - Import strategy follows the guideline set in the Sequelize docs: [http://sequelize.readthedocs.io/en/1.7.0/articles/express/](http://sequelize.readthedocs.io/en/1.7.0/articles/express/)
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
            console.log(`Server listening on port ${ port }!`)
        })
    })
    ```

### `InitializeSequelizeOptions`
- `silent`: `boolean`

### `setConnection(sequelize: Sequelize)`
- If you wish to initialize Sequelize yourself instead of using `initializeSequelize`, but still want to use the singleton pattern, you can set the `connection` variable using this method and use `connection` normally

### `getConnection(): Promise<Sequelize>`
- Returns when all schemas are loaded and `connection` is set
- Throws an error if `initializeSequelize` was never run

### `connection: Sequelize`
- Singleton variable holding the sequelize instance
- Use this to retrieve the value synchronously if you know `connection` will be set by the time this variable is used

### `property(defineAttributes: DefineAttribute)`
- Define a Sequelize property

### `type DefineAttribute = string | Sequelize.DataTypeAbstract | Sequelize.DefineAttributeColumnOptions`
- Note: This is exactly the same as Sequelize.DefineAttributes, except it is for a single property vs. an object containing multiple properties

### `relationships`

- Exports object `relationships`; see below for relationships API

## `sequelize-this/relationships`

### `relationship(relationshipType: string, targetClass: string, options: Sequelize.AssociationOptions)`
- Use this to decorate a class to set a relationship
- Valid types: `'hasOne', 'hasMany', 'belongsTo', 'belongsToMany'`
- `options` is passed directly to Seqeulize (for associations)

### `hasOne(targetClass: string, options: Sequelize.AssociationOptions, overrideOptions)`
- Wrapper for `relationship('hasOne', targetClass, options)`

### `hasMany(targetClass: string, options: Sequelize.AssociationOptions)`
- Wrapper for `relationship('hasMany', targetClass, options)`

### `belongsTo(targetClass: string, options: Sequelize.AssociationOptions)`
- Wrapper for `relationship('belongsTo', targetClass, options)`

### `belongsToMany(targetClass: string, options: Sequelize.AssociationOptions)`
- Wrapper for `relationship('belongsToMany', targetClass, options)`

**EXPERIMENTAL**
```
OverrideOptions: {
    [keyFromAssociationOptions: string] : (schema) => any
}
```
- Note: This is exactly the same as Sequelize.AssociationOptions except you can define a function that is called after the schema is initialized, in case you need to use schema-specific information (perhaps to modify the relationship name due to foreign key conflicts?)
- Pass this in as the 4th argument for `relationship` or 3rd argument for any of the wrapper functions


## Changes

Version 3.1.0
- Fixed the way methods were attached to the schema object
- Included basic test suite (WIP)
- Fixed some option types
- Added SQT-specific options (i.e. silence output)

Version 3.0.0
- Ported to TypeScript
- Better documentation
- Several breaking changes in API, including the way options are passed in
