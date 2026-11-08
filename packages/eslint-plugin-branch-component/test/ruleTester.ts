import {afterAll, describe, test} from 'bun:test'

import {RuleTester} from '@typescript-eslint/rule-tester'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = test
// Bun throws as soon as test.only is read in CI, so only a test that asks for it reads it.
RuleTester.itOnly = (text, callback) => test.only(text, callback)

export const ruleTester = new RuleTester({
  languageOptions: {
    sourceType: 'module',
    parserOptions: {ecmaFeatures: {jsx: true}},
  },
})

export const branchImport = "import Branch from 'branch-component';\n"
