var express = require('express');
var router = express.Router();

const fileUpload = require('express-fileupload');
const Joi = require('joi');
const { codeExport } = require('@seleniumhq/side-code-export')
const { Builder, By, Key, until } = require('selenium-webdriver')

/**
 * middleware
 */
router.use(express.json());
router.use(fileUpload({
    createParentPath: true
}));

/**
 * routes
 */
router.get('/',(req,res)=>{
    res.send("Hello World!");
});

async function emitSuite(format, project, suiteName) {
    return format.emit.suite({
        baseUrl: project.url,
        beforeEachOptions: {},
        enableDescriptionAsComment: true,
        enableOriginTracing: false,
        project,
        suite: project.suites.find((s) => s.name === suiteName),
        tests: project.tests,
    });
}

const format = require('@seleniumhq/code-export-javascript-mocha')
// console.log(codeExport);
// console.log(format.opts);

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
router.post('/post', async (req,res)=>{
    const project = JSON.parse(req.files.test.data.toString());
    let item = project.suites[0];
    // console.log(project);
    const {body, filename} = await emitSuite(format.default,project, item.name);
    const ast = parser.parse(body, {
        sourceType: "module",
        plugins: ['asyncGenerators', 'classProperties']
    });

    const extractedBodies = [];

    traverse(ast, {
        CallExpression(path) {
            if (path.node.callee.name === 'it') {
                // This assumes `it` function has a single argument that is a function
                const body = path.node.arguments[1].body;
                extractedBodies.push(...body.body);
            }
        }
    });

    // Create a new program that exports a function containing the extracted code
    const newProgramBody = [
        t.exportNamedDeclaration(
            t.functionDeclaration(
                t.identifier('executeTestActions'), // Function name
                [], // Params
                t.blockStatement(extractedBodies), // Body containing the extracted code
                false, // Generator flag
                true // Async flag, assuming the code uses async/await
            ),
            [] // Export specifiers
        )
    ];

    // Replace the original program body with the new one
    ast.program.body = newProgramBody;

    // Generate the new code from the modified AST
    const { code: newCode } = generate(ast);
    const {executeTestActions} = await import(`data:text/javascript;base64,${btoa("const { Builder, By, Key, until } = import('selenium-webdriver');"+newCode)}`);
    console.log(executeTestActions);
    _driver = await new Builder().forBrowser('chrome').build();
    await executeTestActions(driver=_driver);
    _driver.close();
    // console.log(filename);
    res.send(req.files.test.name);

});

module.exports = router;