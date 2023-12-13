const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
};




app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello my dear smartShopBD server is running');
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mi7otul.mongodb.net/?retryWrites=true&w=majority`;

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
        const db = client.db('shop');

        const cardCollection = db.collection('productsCollaction');
        const cartCollection = db.collection("cartCollection")

        app.get('/cardCollection', async (req, res) => {
            const result = await cardCollection.find().toArray();
            res.send(result);
        });
        app.get('/cardCollection/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await cardCollection.findOne(query);
            res.send(result);
        });

        app.get("/carts", async (req, res) => {
            const email = req.query.email;
            if (!email) {
              res.send([]);
            };

            const query = { email: email };
            const results = await cartCollection.find(query).toArray();
            // console.log(results)
            res.send(results)
          })

        app.post("/carts", async (req, res) => {
            const carts = req.body;
            // console.log(carts)
            const result = await cartCollection.insertOne(carts);
            res.send(result)
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`smartShopBD server running on port${port}`);
});