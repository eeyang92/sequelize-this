import * as isEqual from 'lodash.isequal'

export function getElementsInSecondArrayNotPresentInFirstArray(array1: Array<any>, array2: Array<any>) {
    if (array2.length === 0) {
        return []
    }

    if (array1.length === 0) {
        return array2.slice()
    }

    return array2.filter((element2) => {
        return !array1.some((element1) => {
            return isEqual(element2, element1)
        })
    })
}
