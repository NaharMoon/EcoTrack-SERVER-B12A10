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
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // project code---------------------(start)
        // mongoDB------------------
        const EcoTrack_DB = client.db("EcoTrack_DB");
        const challengesCollection = EcoTrack_DB.collection("challenges");
        const usersCollection = EcoTrack_DB.collection("users");
        //gp-----------------
        const userChallengesCollection = EcoTrack_DB.collection("userChallenges");
        const tipsCollection = EcoTrack_DB.collection("tips");
        const eventsCollection = EcoTrack_DB.collection("events");

        // ✅ same user একই challenge 2 বার join করতে পারবে না
        await userChallengesCollection.createIndex(
            { userId: 1, challengeId: 1 },
            { unique: true }
        );
        //gp______________________

        // mongoDB__________________

        // APIs---------------------
        //challenges APIs---------------------
        app.post('/api/challenges', async (req, res) => {
            const newChallenge = req.body;
            const result = await challengesCollection.insertOne(newChallenge);
            res.send(result);
        })
        // gp----------------------
        // ✅ 1) featured FIRST
        app.get('/api/challenges/featured', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 4;

                const result = await challengesCollection
                    .find({ featured: true })
                    .sort({ startDate: -1 }) // startDate string "YYYY-MM-DD" OK
                    .limit(limit)
                    .toArray();

                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        // gp______________________

        // app.get('/api/challenges', async (req, res) => {
        //     const cursor = challengesCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })
        // gp----------------------
        app.get("/api/challenges", async (req, res) => {
            try {
                const { categories } = req.query;

                let query = {};

                // ✅ category filter using $in
                // example: ?categories=Water%20Conservation,Energy%20Saving
                if (categories) {
                    const categoryArray = categories
                        .split(",")
                        .map((c) => c.trim())
                        .filter(Boolean);

                    if (categoryArray.length > 0) {
                        query.category = { $in: categoryArray };
                    }
                }

                const result = await challengesCollection.find(query).toArray();

                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        // gp______________________

        app.get('/api/challenges/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await challengesCollection.findOne(query);
            res.send(result);
        })
        app.delete('/api/challenges/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await challengesCollection.deleteOne(query);
            res.send(result);
        })
        app.patch('/api/challenges/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedChallenge = req.body;
            const update = {
                $set: {
                    description: updatedChallenge.description,
                    duration: updatedChallenge.duration,
                    imageUrl: updatedChallenge.imageUrl,
                }
            };
            const result = await challengesCollection.updateOne(query, update);
            res.send(result);
        })
        //challenges APIs_______________________

        // users APIs---------------------------
        app.post('/api/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.user_email;
            const query = { user_email: email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'User already exist in database. Do not need to insert!' });
            }
            else {
                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            }
        })
        // unUsed users API
        app.get('/api/users', async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        // users APIs___________________________

        //gp------------------
        // ✅ Join a Challenge
        app.post("/api/challenges/join/:id", async (req, res) => {
            try {
                const challengeId = req.params.id;
                const { userId } = req.body; // email বা uid

                if (!ObjectId.isValid(challengeId)) {
                    return res.status(400).send({ message: "Invalid challenge id" });
                }
                if (!userId) {
                    return res.status(400).send({ message: "userId is required" });
                }

                const challenge = await challengesCollection.findOne({
                    _id: new ObjectId(challengeId),
                });

                if (!challenge) {
                    return res.status(404).send({ message: "Challenge not found" });
                }

                // 1) userChallenges এ insert (duplicate হলে 409)
                try {
                    await userChallengesCollection.insertOne({
                        userId,
                        challengeId: new ObjectId(challengeId),
                        status: "Not Started",
                        progress: 0,
                        joinDate: new Date(),
                    });
                } catch (err) {
                    if (err.code === 11000) {
                        return res.status(409).send({ message: "Already joined" });
                    }
                    throw err;
                }

                // 2) challenges collection এ participants বাড়ানো
                await challengesCollection.updateOne(
                    { _id: new ObjectId(challengeId) },
                    { $inc: { participants: 1 } }
                );

                res.send({ joined: true, message: "Joined successfully" });
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        // ✅ Check user already joined কিনা (UI তে disable করার জন্য)
        app.get("/api/user-challenges/check", async (req, res) => {
            try {
                const { userId, challengeId } = req.query;

                if (!userId || !challengeId || !ObjectId.isValid(challengeId)) {
                    return res.send({ joined: false });
                }

                const exists = await userChallengesCollection.findOne({
                    userId,
                    challengeId: new ObjectId(challengeId),
                });

                res.send({ joined: !!exists });
            } catch (error) {
                console.log(error);
                res.status(500).send({ joined: false });
            }
        });

        // ✅ My Activities (user join করা challenges list)
        app.get("/api/user-challenges", async (req, res) => {
            try {
                const { userId } = req.query;
                if (!userId) return res.status(400).send({ message: "userId is required" });

                const joinedList = await userChallengesCollection
                    .find({ userId })
                    .sort({ joinDate: -1 })
                    .toArray();

                res.send(joinedList);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        // ✅ Update Progress (status + progress + lastUpdated)
        app.patch("/api/user-challenges/progress/:id", async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid id" });
                }

                const { status, progress } = req.body;

                const updateDoc = {
                    $set: {
                        status: status || "Not Started",
                        progress: Number(progress) || 0,
                        lastUpdated: new Date(),
                    },
                };

                const result = await userChallengesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );

                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        // Tips APIs---------------gp
        app.post("/api/tips", async (req, res) => {
            try {
                const tip = req.body;

                // minimal default fields
                tip.createdAt = tip.createdAt ? new Date(tip.createdAt) : new Date();
                tip.upvotes = Number(tip.upvotes || 0);

                const result = await tipsCollection.insertOne(tip);
                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        app.get("/api/tips", async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 5;

                const result = await tipsCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .toArray();

                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        // Events APIs-----------------
        app.post("/api/events", async (req, res) => {
            try {
                const event = req.body;

                // store date as Date
                event.date = event.date ? new Date(event.date) : new Date();

                event.maxParticipants = Number(event.maxParticipants || 0);
                event.currentParticipants = Number(event.currentParticipants || 0);

                const result = await eventsCollection.insertOne(event);
                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });
        app.get("/api/events", async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 4;

                const result = await eventsCollection
                    .find()
                    .sort({ date: 1 })  // string date "YYYY-MM-DDTHH:mm:ssZ" also sorts OK
                    .limit(limit)
                    .toArray();

                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        //gp__________________
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
