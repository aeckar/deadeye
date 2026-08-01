import * as fs from 'fs'
import Mocha from 'mocha'
import * as path from 'path'

/**
 * Mocha test runner.
 * 
 * Mocha is preferred over Vitest for being an unbundled testing framework that may
 * work better with VS Code Extension Host.
 */
export async function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', timeout: 10000, color: true })
    const testsRoot = __dirname
    const files = fs.readdirSync(testsRoot).filter(f => f.endsWith('.test.js'))
    for (const f of files) {
        mocha.addFile(path.join(testsRoot, f))
    }
    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} test(s) failed.`))
            } else {
                resolve()
            }
        })
    })
}
