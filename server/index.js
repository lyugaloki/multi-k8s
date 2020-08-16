const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require("cors");

const app = express();
app.unsubscribe(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
});

pgClient.on('connect', () => {
    pgClient
        .query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch( err => console.log('CREATE TABLE error:', err) );
})

// For debugging ONLY
console.log(keys);

// Redis Client Setup
const redis = require('redis');
const redisClient  = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000 // if we lose connection to redis, try to reconnect once every 1000 milliseconds
});

const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req,res)=> {
    res.send('Hi jiko');
});

app.get('/values/all', async(req,res) => {
    const values = await pgClient.query('SELECT * from values');

    res.send(values.rows);
})

app.get('/values/current', async(req,res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    })
})

app.post('/values', async(req,res) => {
    const index = req.body.index;
    
    // Maximum index we accept is 40 (because if index is too high, calculation takes too long)
    if( parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working: true});
});

app.listen(5000, err => {
    console.log('Listening');
});