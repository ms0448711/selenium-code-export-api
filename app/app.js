"use strict"

/**
 * Module dependencies.
 */

const express = require('express');
const app = express();
const path = require('node:path');
const router = require(path.resolve(__dirname,'controllers/api.js'));

app.use('/api',router);


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));