import { getElementsInSecondArrayNotPresentInFirstArray } from '../src/util'

test('getElementsInSecondArrayNotPresentInFirstArray returns empty array if array2 is empty', () => {
    const array1 = [{ test: 1 }]
    const array2 = []

    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).toEqual([])
})

test('getElementsInSecondArrayNotPresentInFirstArray returns copy of array2 if array1 is empty', () => {
    const array1 = []
    const array2 = [{ test: 2 }, { test: 3 }]

    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).not.toBe(array2)
    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).toEqual([{ test: 2 }, { test: 3 }])
})

test('getElementsInSecondArrayNotPresentInFirstArray to return copy of array2 if all are unique', () => {
    const array1 = [{ test: 1 }, { test: 2 }]
    const array2 = [{ test: 3 }, { test: 4 }]

    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).not.toBe(array2)
    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).toEqual([{ test: 3 }, { test: 4 }])
})

test('getElementsInSecondArrayNotPresentInFirstArray to return unique element from array2', () => {
    const array1 = [{ test: 1 }, { test: 2 }]
    const array2 = [{ test: 2 }, { test: 3 }]

    expect(getElementsInSecondArrayNotPresentInFirstArray(array1, array2)).toEqual([{ test: 3 }])
})
