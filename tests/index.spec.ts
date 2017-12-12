import * as Sequelize from 'sequelize'
import * as SequelizeMock from 'sequelize-mock'
import { classToSequelizeSchema, property } from '../src/index'

test('classToSequelizeSchema produces the same schema as sequelize.define', () => {
    class Test {
        @property({ type: Sequelize.INTEGER })
        test

        yes() {
            console.log('yes')
        }
    }

    const mockConnection = new SequelizeMock()
    const mockConnection2 = new SequelizeMock()

    const schemaFun = classToSequelizeSchema(Test)
    const schema = schemaFun(mockConnection)

    const UserMock = mockConnection2.define('Test', {
        'test': { type: Sequelize.INTEGER }
    }, {
        instanceMethods: {
            yes: Test.prototype.yes
        }
    })

    delete schema['options']['sequelize']
    delete UserMock['options']['sequelize']

    expect(schema['options']).toEqual(UserMock['options'])
    expect(schema['name']).toEqual(UserMock['name'])
    expect(schema['tableName']).toEqual(UserMock['tableName'])
})
