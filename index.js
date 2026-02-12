const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ogvd1me.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ✅ collections (global)
let challengesCollection;
let usersCollection;
let userChallengesCollection;
let tipsCollection;
let eventsCollection;

let indexed = false;

// ✅ connect helper
async function connectDB() {
  if (challengesCollection) return; // already set

  await client.connect();
  const EcoTrack_DB = client.db("EcoTrack_DB");

  challengesCollection = EcoTrack_DB.collection("challenges");
  usersCollection = EcoTrack_DB.collection("users");
  userChallengesCollection = EcoTrack_DB.collection("userChallenges");
  tipsCollection = EcoTrack_DB.collection("tips");
  eventsCollection = EcoTrack_DB.collection("events");

  // ✅ index only once
  if (!indexed) {
    await userChallengesCollection.createIndex(
      { userId: 1, challengeId: 1 },
      { unique: true }
    );
    indexed = true;
  }

  console.log("✅ MongoDB connected");
}

// ✅ middleware: all /api routes will ensure DB connection
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.log("❌ DB error:", err);
    res.status(500).send({ message: "Database connection failed" });
  }
});

/* ----------------- ROUTES ----------------- */

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Challenges
app.post("/api/challenges", async (req, res) => {
  const newChallenge = req.body;
  const result = await challengesCollection.insertOne(newChallenge);
  res.send(result);
});

// ✅ featured
app.get("/api/challenges/featured", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;

    const result = await challengesCollection
      .find({ featured: true })
      .sort({ startDate: -1 })
      .limit(limit)
      .toArray();

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Server error" });
  }
});

// ✅ category filter (simple)
app.get("/api/challenges", async (req, res) => {
  try {
    const { categories } = req.query;
    let query = {};

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

app.get("/api/challenges/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await challengesCollection.findOne(query);
  res.send(result);
});

app.delete("/api/challenges/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await challengesCollection.deleteOne(query);
  res.send(result);
});

app.patch("/api/challenges/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updatedChallenge = req.body;

  const update = {
    $set: {
      description: updatedChallenge.description,
      duration: updatedChallenge.duration,
      imageUrl: updatedChallenge.imageUrl,
    },
  };

  const result = await challengesCollection.updateOne(query, update);
  res.send(result);
});

// Users
app.post("/api/users", async (req, res) => {
  const newUser = req.body;
  const email = req.body.user_email;

  const query = { user_email: email };
  const existingUser = await usersCollection.findOne(query);

  if (existingUser) {
    res.send({ message: "User already exist in database. Do not need to insert!" });
  } else {
    const result = await usersCollection.insertOne(newUser);
    res.send(result);
  }
});

app.get("/api/users", async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});

// Join challenge
app.post("/api/challenges/join/:id", async (req, res) => {
  try {
    const challengeId = req.params.id;
    const { userId } = req.body;

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

// check joined
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

// my activities
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

// update progress
app.patch("/api/user-challenges/progress/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid id" });

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

// tips
app.post("/api/tips", async (req, res) => {
  try {
    const tip = req.body;
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

// events
app.post("/api/events", async (req, res) => {
  try {
    const event = req.body;
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
      .sort({ date: 1 })
      .limit(limit)
      .toArray();

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Server error" });
  }
});

/* ----------------- EXPORT (Vercel) ----------------- */
module.exports = app;

/* ----------------- LOCAL ONLY ----------------- */
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Local server running on port ${port}`));
}
