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
        const cartCollection = db.collection("cartCollection");
        const proceedCollection = db.collection("proceedCollection");
        const sellerProfileCollection = db.collection("sellerProfileCollection");

        app.get('/cardCollection', async (req, res) => {
            const result = await cardCollection.find().toArray();
            res.send(result);
        });
        app.get('/cardCollection/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await cardCollection.findOne(query);
            res.send(result);
        });
        app.get('/cardCollection/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.find(query).toArray()
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

        app.get('/api/search', async (req, res) => {
            try {
                const { query, category, page = 1, pageSize = 10 } = req.query;

                let filter = {};
                if (query) {
                    filter.productTitle = { $regex: `.*${query}.*`, $options: 'i' };
                    // Case-insensitive search with any substring of the product title
                }
                if (category) {
                    filter.category = category; // Filter by category
                }
                const skip = (page - 1) * pageSize;
                const results = await cardCollection.find(filter).skip(skip).limit(parseInt(pageSize)).toArray();

                res.send(results);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.get("/confirmOrder", async (req, res) => {
            const email = req.query.email;
            // console.log(email)
            if (!email) {
                res.send([]);
            };

            const query = { email: email };
            const results = await proceedCollection.find(query).toArray();
            // console.log(results)
            res.send(results)
        })

        app.get('/users/admin/:email', async (req, res) => {
            try {
                const userEmail = req.params.email;
                // Query the database to find the user with the specified email
                const user = await usersCollection.findOne({ email: userEmail });

                if (user && user.roll && user.roll.admin) {
                    res.send({ admin: true });
                } else {
                    res.send({ admin: false });
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/users/seller/:email', async (req, res) => {
            try {
                const userEmail = req.params.email;
                // Query the database to find the user with the specified email
                const user = await sellerProfileCollection.findOne({ email: userEmail });


                if (user && user.roll && user?.roll?.seller === true) {
                    res.send({ seller: true });
                } else {
                    res.send({ seller: false });
                }
            } catch (error) {
                console.error('Error checking seller status:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });



        app.post("/carts", async (req, res) => {
            const carts = req.body;
            // console.log(carts)
            const result = await cartCollection.insertOne(carts);
            res.send(result)
        });

        app.post("/proceedToCheckOut", async (req, res) => {
            try {
                const product = req.body.product;
                const options = { ordered: true };
                const result = await proceedCollection.insertMany(product, options);
                res.send(result);
            } catch (error) {
                console.error('Error processing checkout:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.post("/placeOrder", async (req, res) => {
            const product = req.body;
            // console.log(product)
            const result = await proceedCollection.insertOne(product);
            res.send(result)
        });

        app.post('/sellerProfile', async (req, res) => {
            try {
                const { sellerProfile } = req.body;
                const existingProfile = await sellerProfileCollection.findOne({ email: sellerProfile.email });

                if (existingProfile) {
                    // If the email already exists, respond with an error
                    return res.status(400).send({ success: false, error: 'Email already in use' });
                }

                const result = await sellerProfileCollection.insertOne(sellerProfile);
                res.status(201).send({ success: true, data: result });
            } catch (error) {
                // Handle any errors that occurred during processing
                console.error(error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });


        app.delete("/carts", async (req, res) => {
            const productIds = req.body.productIds;
            // console.log(productIds)
            const objectIds = productIds.map(id => new ObjectId(id));
            // Specify the filter to match documents for deletion
            const filter = { _id: { $in: objectIds } };
            // Perform the delete operation
            const result = await cartCollection.deleteMany(filter);
            res.send(result)
        });

        app.delete("/cart/:id", (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = cartCollection.deleteOne(query);
            res.send(result);
        });

        app.delete("/cancelOrder/:id", async (req, res) => {
            try {
                const { id } = req.params;
                // console.log(id)
                const query = { productsId: id };

                const result = await proceedCollection.deleteOne(query);
                // console.log(result)

                // res.send(result)

                if (result.deletedCount === 1) {
                    res.status(200).send({ message: "Order cancelled successfully" });
                } else {
                    res.status(404).send({ message: "Order not found" });
                }
            } catch (error) {
                console.error("Error cancelling order:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`smartShopBD server running on port${port}`);
});