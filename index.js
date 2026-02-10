const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
app.use(cors())
app.use(express.json());
const port = process.env.PORT || 5000;

//MongoDb------------------------(start)
// EcoTrackDBUser
// BAuifZfPWeFAQyZP
// mongodb userName, pass

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ogvd1me.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // project code---------------------(start)
        // mongoDB------------------
        const EcoTrack_DB = client.db("EcoTrack_DB");
        const challengesCollection = EcoTrack_DB.collection("challenges");
        const usersCollection = EcoTrack_DB.collection("users");
        // mongoDB__________________

        // APIs---------------------
        //challenges APIs---------------------
        app.post('/api/challenges', async (req, res) => {
            const newChallenge = req.body;
            const result = await challengesCollection.insertOne(newChallenge);
            res.send(result);
        })
        app.get('/api/challenges', async (req,res) => {
            const cursor = challengesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/api/challenges/:id', async (req,res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await challengesCollection.findOne(query);
            res.send(result);
        })
        app.delete('/api/challenges/:id', async (req,res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await challengesCollection.deleteOne(query);
            res.send(result);
        })
        app.patch('/api/challenges/:id', async (req,res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const updatedChallenge = req.body;
            const update = {
                $set: {
                    description: updatedChallenge.description,
                    duration: updatedChallenge.duration,
                    imageUrl: updatedChallenge.imageUrl,
                }
            };
            const result = await challengesCollection.updateOne(query,update);
            res.send(result);
        })
        //challenges APIs_______________________

        // users APIs---------------------------
        app.post('/api/users', async (req,res) => {
            const newUser = req.body;
            const email = req.body.user_email;
            const query = { user_email: email};
            const existingUser = await usersCollection.findOne(query);
            if(existingUser) {
                res.send({message : 'User already exist in database. Do not need to insert!'});
            }
            else {
                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            }
        })
        // unUsed users API
        app.get('/api/users', async (req,res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        // users APIs___________________________
        //APIs______________________

        // project code---------------------(end)

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

//MongoDb------------------------(end)

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
