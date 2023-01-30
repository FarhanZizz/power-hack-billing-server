const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

// MiddleWare
app.use(express.json());
app.use(cors());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.d0hszsm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const userCollections = client.db("power-hack").collection("user");
    const billCollections = client.db("power-hack").collection("bill");

    app.post("/registration", async (req, res) => {
      const { email, password } = req.body;
      const userExist = await userCollections.findOne({ email });
      if (userExist) {
        return res.status(400).send({ message: "Email already exists" });
      } else {
        const newUser = { email, password };
        await userCollections.insertOne(newUser);
        const payload = { email: newUser.email };
        const token = jwt.sign(payload, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ token });
      }
    });
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await userCollections.findOne({ email });
      if (!user) {
        return res.status(400).send({ message: "Email not found" });
      } else if (password !== user.password) {
        return res.status(400).send({ message: "Incorrect password" });
      } else {
        const payload = { email: user.email };
        const token = jwt.sign(payload, process.env.ACCESS_TOKEN);
        return res.send({ token });
      }
    });
    app.get("/billing-list", verifyJWT, async (req, res) => {
      const page = parseInt(req.query.page);
      const decodedEmail = req.decoded.email;
      const query = { user: decodedEmail };
      const result = await billCollections
        .find(query)
        .sort({ time: -1 })
        .skip(page * 10)
        .limit(10)
        .toArray();

      const count = await billCollections.estimatedDocumentCount();
      res.send({ result, count });
    });
    app.post("/add-billing", verifyJWT, async (req, res) => {
      const { name, email, phone, amount, time } = req.body;
      const decodedEmail = req.decoded.email;
      const bill = {
        name,
        email,
        phone,
        amount,
        time,
        user: decodedEmail,
      };
      const result = await billCollections.insertOne(bill);
      res.send(result);
    });
    app.patch("/update-billing/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { name, email, phone, amount } = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: false };
      const updateDoc = {
        $set: {
          name,
          email,
          phone,
          amount,
        },
      };
      const result = await billCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.delete("/delete-billing/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await billCollections.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("server running");
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
