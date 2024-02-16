var express = require('express');
var router = express.Router();

const fileUpload = require('express-fileupload');
const Joi = require('joi');
const { codeExport } = require('@seleniumhq/side-code-export')
var { Builder, By:_By, Key:_Key, until:_until } = require('selenium-webdriver')
const firefox = require('selenium-webdriver/firefox');
const javascript_format = require('@seleniumhq/code-export-javascript-mocha')
const java_format = require('@seleniumhq/code-export-java-junit')
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

/**
 * middleware
 */

router.use(express.json());
router.use(fileUpload({
    createParentPath: true
}));


/**
 * util functions
 */
function projectPreprocess(project){
    for(let i = 0; i<project.tests.length; i++){
        let test=project.tests[i];
        for(let j = 0;j<test.commands.length;j++){
            let cmd=test.commands[j];
            if(cmd.value==="")
                cmd.value=' ';
        }
    }
}

async function emitSuite(format, project, suiteName) {
    projectPreprocess(project,suiteName);

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

function generateNewCode(body){
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
    return generate(ast);
}

/**
 * routes
 */
const available_langs=["javascript-mocha", "java-junit"];

router.get('/export', async (req,res)=>{
    res.send({
        "lang": available_langs
    });
});

router.post('/export', async (req,res, next)=>{
    const fschema=Joi.object({
        script: Joi.object({
            name: Joi.string(),
            data: Joi.any()
        })
    }).options({allowUnknown: true});
    const {error:ferror} = fschema.validate(req.files);
    if(ferror) {
        res.send(ferror.details[0].message);
        return;
    }

    const schema = Joi.object({
        lang: Joi.string().valid(...available_langs)
    });
    const {error} = schema.validate(req.body);
    if(error){
        res.send(error.details[0].message);
        return
    }
    try{
        let format = null;
        switch(req.body.lang){
            case "javascript-mocha":
                format = javascript_format
                break;
            case "java-junit":
                format = java_format
                break;
        }
        const project = JSON.parse(req.files.script.data.toString());
        let item = project.suites[0];
        const {body} = await emitSuite(format.default,project, item.name);
        
        res.send({
            lang:req.body.lang,
            code:body
        })
    }
    catch(e){
        next(e);
    }
    
});

router.post('/screenshot', async (req,res, next)=>{
    const fschema=Joi.object({
        script: Joi.object({
            name: Joi.string(),
            data: Joi.any()
        })
    }).options({allowUnknown: true});
    const {error:ferror} = fschema.validate(req.files);
    if(ferror) {
        res.send(ferror.details[0].message);
        return;
    }
    try{
        const project = JSON.parse(req.files.script.data.toString());
        let item = project.suites[0];
        const {body} = await emitSuite(javascript_format.default,project, item.name);
        const { code: newCode } = generateNewCode(body);
        const {executeTestActions} = await import(`data:text/javascript;base64,${btoa(newCode)}`);
        let _driver = await new Builder().forBrowser('firefox').setFirefoxOptions(new firefox.Options().addArguments('--headless')).build();
        await _driver.manage().setTimeouts({ implicit: 10000 });
        await executeTestActions(By=_By,Key=_Key,until=_until,driver=_driver);
        await new Promise(resolve => setTimeout(resolve, 10000));
        var base64Data="";
        await _driver.takeScreenshot().then(
            function(data){
                base64Data=data;
            });
        await _driver.close();
        res.send({
            file_name:req.files.script.name,
            suite_name:item.name,
            image:base64Data
        });
    }catch(e){
        next(e);
    }
});

module.exports = router;