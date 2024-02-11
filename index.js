// Import necessary modules and libraries
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config(); // Load environment variables
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// Set up CORS options for cross-origin resource sharing
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
};



// Use CORS middleware and parse JSON requests
app.use(cors(corsOptions));
app.use(express.json());

// Define a simple root route
app.get('/', (req, res) => {
    res.send('Hello my dear smartShopBD server is running');
});


// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mi7otul.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res
            .status(401)
            .send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    });
};


// Async function to run the server and connect to MongoDB 
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const db = client.db('shop');

        const cardCollection = db.collection('productsCollaction');
        const cartCollection = db.collection("cartCollection");
        const proceedCollection = db.collection("proceedCollection");
        const userCollection = db.collection("usersCollection");

        // Define various API endpoints for CRUD operations on collections

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ token });
        })

        // Get all products from 'productsCollaction'
        app.get('/cardCollection', async (req, res) => {
            const result = await cardCollection.find().toArray();
            res.send(result);
        });

        // Get a single product by ID from 'productsCollaction'
        app.get('/cardCollection/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await cardCollection.findOne(query);
            res.send(result);
        });

        // Get cart items by user email from 'cartCollection'
        app.get("/carts", verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            };

            const query = { email: email };
            const results = await cartCollection.find(query).toArray();
            // console.log(results)
            res.send(results)
        })

        // Search products by query and category
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

        // Get confirmed orders by user email from 'proceedCollection'
        app.get("/confirmOrder", verifyJWT, async (req, res) => {
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

        // Check if a user has admin privileges
        app.get('/users/admin/:email', async (req, res) => {
            try {
                const userEmail = req.params.email;
                // Query the database to find the user with the specified email
                const user = await userCollection.findOne({ email: userEmail });

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

        // Check if a user has seller privileges
        app.get('/users/seller/:id',verifyJWT, async (req, res) => {
            try {
                const {id} = req.params;
                const query = { _id: new ObjectId(id) }
                // Query the database to find the user with the specified id
                const user = await userCollection.findOne(query);
                res.send(user);
            } catch (error) {
                console.error('Error checking seller status:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        // Add items to the cart
        app.post("/carts", async (req, res) => {
            const carts = req.body;
            // console.log(carts)
            const result = await cartCollection.insertOne(carts);
            res.send(result)
        });

        // Proceed to checkout and add items to 'proceedCollection'
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

        // Place an order and add items to 'proceedCollection'
        app.post("/placeOrder", async (req, res) => {
            const product = req.body;
            // console.log(product)
            const result = await proceedCollection.insertOne(product);
            res.send(result)
        });


        app.post('/sellerRegister', async (req, res) => {
            try {
                const { email, password, phoneNumber, roll } = req.body.sellerRegister;

                // Input validation
                if (!email || !password) {
                    return res.status(400).json({ success: false, error: 'Email and password are required' });
                }

                const existingProfile = await userCollection.findOne({ email });

                if (existingProfile) {
                    // If the email already exists, respond with an error
                    return res.status(409).json({ success: false, error: 'Email already in use' });
                }

                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Save the user with hashed password
                const result = await userCollection.insertOne({ email, password: hashedPassword, phone: phoneNumber, roll });

                // Respond with the created user
                res.status(201).send({ success: true, data: result });
            } catch (error) {
                // Handle any errors that occurred during processing
                console.error('Error during seller registration:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error during registration' });
            }
        });

        app.post('/auth/login', async (req, res) => {
            try {
                const { email, password } = req.body;
                // Input validation
                if (!email || !password) {
                    return res.status(400).json({ message: 'Email and password are required' });
                }

                const user = await userCollection.findOne({ email: email });

                // Check if the user exists
                if (!user) {
                    return res.status(401).json({ message: 'Invalid email or password' });
                }

                const isPasswordValid = await bcrypt.compare(password, user.password);

                // If the password is not valid, return an error
                if (!isPasswordValid) {
                    return res.status(401).json({ message: 'Invalid email or password' });
                }

                // Send only necessary information in the response
                res.status(200).send({
                    userId: user._id,
                    email: user?.email,
                    phone: user?.phone,
                    roll: user?.roll
                });

            } catch (error) {
                // Handle any errors that occurred during processing
                console.error('Error during login:', error);
                res.status(500).json({ message: 'Internal Server Error during login' });
            }
        });



        // Delete all items from the cart
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

        // Delete single items from the cart
        app.delete("/cart/:id", (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = cartCollection.deleteOne(query);
            res.send(result);
        });

        // Cancel an order in 'proceedCollection'
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