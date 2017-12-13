import * as Sequelize from 'sequelize'
import * as SequelizeMock from 'sequelize-mock'
import { classToSequelizeSchema, property, setConnection, getConnection, connection } from '../src/index'

let mockConnection: any = null
let mockConnection2: any = null

function compareSchema(schema1, schema2) {
    const _schema1 = Object.assign({}, schema1)
    const _schema2 = Object.assign({}, schema2)

    delete _schema1['options']['sequelize']
    delete _schema2['options']['sequelize']

    expect(_schema1['options']).toEqual(_schema2['options'])
    expect(_schema1['name']).toEqual(_schema2['name'])
    expect(_schema1['tableName']).toEqual(_schema2['tableName'])
}

beforeEach(() => {
    mockConnection = new SequelizeMock()
    mockConnection2 = new SequelizeMock()
})

test('classToSequelizeSchema produces the same schema as sequelize.define', () => {
    class Test {}

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const TestMock = mockConnection2.define('Test')

    compareSchema(schema, TestMock)
})

test('classToSequelizeSchema produces the same schema (with properties) as sequelize.define', () => {
    class Test {
        @property(Sequelize.INTEGER)
        test

        @property({ type: Sequelize.STRING })
        test2
    }

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const TestMock = mockConnection2.define('Test', {
        'test': Sequelize.INTEGER,
        'test2': { type: Sequelize.STRING }
    })

    compareSchema(schema, TestMock)
})

test('classToSequelizeSchema produces the same schema (with methods) as sequelize.define', () => {
    class Test {
        yes() {
            console.log('yes')
        }

        no() {
            console.log('no')
        }
    }

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const TestMock = mockConnection2.define('Test', {}, {
        instanceMethods: {
            yes: Test.prototype.yes,
            no: Test.prototype.no
        }
    })

    compareSchema(schema, TestMock)
})

test('classToSequelizeSchema produces the same schema (with static methods) as sequelize.define', () => {
    class Test {
        static yes() {
            console.log('yes')
        }

        static no() {
            console.log('no')
        }
    }

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const TestMock = mockConnection2.define('Test', {}, {
        classMethods: {
            yes: Test.yes,
            no: Test.no
        }
    })

    compareSchema(schema, TestMock)
})

test('classToSequelizeSchema produces the same schema (with properties, methods, and static methods) as sequelize.define', () => {
    class Test {
        @property({ type: Sequelize.BOOLEAN })
        test

        yes() {
            console.log('yes')
        }

        static no() {
            console.log('no')
        }
    }

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const TestMock = mockConnection2.define('Test', {
        'test': { type: Sequelize.BOOLEAN }
    }, {
        instanceMethods: {
            yes: Test.prototype.yes
        },
        classMethods: {
            no: Test.no
        }
    })

    compareSchema(schema, TestMock)
})

test('setConnection correctly sets connection singleton', () => {
    setConnection(mockConnection)

    expect(mockConnection).toBe(connection)
})

test('getConnection does not work unless initializeSequelize is called first', () => {
    expect(getConnection).toThrowError('Sequelize connection was never initiated')
})

test('property adds _sqtMetadata to class', () => {
    class Test {
        @property({ type: Sequelize.BOOLEAN })
        test
    }

    const expectedSqtMetadata = {
        properties: {
            test: { type: Sequelize.BOOLEAN }
        }
    }

    expect(Test.prototype['_sqtMetadata']).toEqual(expectedSqtMetadata)
})

test('property adds and modifies _sqtMetadata on class', () => {
    class Test {
        @property({ type: Sequelize.BOOLEAN })
        test

        @property({ type: Sequelize.INTEGER })
        test2
    }

    const expectedSqtMetadata = {
        properties: {
            test: { type: Sequelize.BOOLEAN },
            test2: { type: Sequelize.INTEGER }
        }
    }

    expect(Test.prototype['_sqtMetadata']).toEqual(expectedSqtMetadata)
})

test('property adds and modifies _sqtMetadata on class with superclass', () => {
    class BaseTest {
        @property({ type: Sequelize.STRING })
        test1
    }

    class Test extends BaseTest {
        @property({ type: Sequelize.BOOLEAN })
        test2

        @property({ type: Sequelize.INTEGER })
        test3
    }

    const expectedSqtMetadata = {
        properties: {
            test1: { type: Sequelize.STRING },
            test2: { type: Sequelize.BOOLEAN },
            test3: { type: Sequelize.INTEGER }
        }
    }

    expect(Test.prototype['_sqtMetadata']).toEqual(expectedSqtMetadata)
})
