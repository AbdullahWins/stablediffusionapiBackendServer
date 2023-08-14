const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const axios = require("axios");
const request = require("request");
const { Configuration, OpenAIApi } = require("openai");

const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

//mongodb config
const uri = process.env.MONGODB_URI;
const databaseName = process.env.DATABASENAME;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//server
const run = async () => {
  try {
    const itemsCollection = client.db(databaseName).collection("items");
    //create
    app.post("/items", async (req, res) => {
      const items = req.body;
      const result = await itemsCollection.insertOne(items);
      console.log(result);
      res.send(result);
    });
    // dalle
    app.post("/dalle", async (req, res) => {
      const items = req.body;
      try {
        //configure openai
        const configuration = new Configuration({
          apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);

        //structured prompt
        const data = {
          prompt: items?.prompt,
          n: 1,
          size: "1024x1024",
        };
        //creating image
        const response = await openai.createImage(data);
        //adding the response to the database
        const result = await itemsCollection.insertOne(response);
        console.log(response);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .send("An error occurred while processing your request.");
      }
    });

    //stablediffusion
    app.post("/sd", async (req, res) => {
      const items = req.body;
      //structured prompt
      const data = {
        key: process.env.STABBLE_DIFFUSION_API_KEY,
        prompt: items?.prompt,
        negative_prompt: items?.negative_prompt,
        width: "512",
        height: "512",
        samples: "1",
        num_inference_steps: "20",
        seed: null,
        guidance_scale: 7.5,
        safety_checker: "yes",
        multi_lingual: "no",
        panorama: "no",
        self_attention: "no",
        upscale: "no",
        embeddings_model: null,
        webhook: null,
        track_id: null,
      };
      //api call to stabblediffusionapi
      try {
        const response = await axios.post(
          "https://stablediffusionapi.com/api/v3/text2img",
          data,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const imageURL = response?.data?.output[0];
        console.log(imageURL);
        const items = response?.data;
        const result = await itemsCollection.insertOne(items);
        const id = result?.insertedId;
        res.status(200).json({ imageURL, id });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    //read
    app.get("/items", async (req, res) => {
      const query = {};
      const cursor = itemsCollection.find(query);
      const items = await cursor.toArray();
      console.log(items);
      res.send(items);
    });
    //update
    app.patch("/items/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const updateDocument = { $set: req.body }; //use $set operator to update fields

      try {
        const result = await itemsCollection.updateOne(query, updateDocument);
        console.log(result);

        //check if any documents were modified
        if (result.matchedCount === 0) {
          return res.status(404).send("No document found for the provided ID.");
        }
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while updating the document.");
      }
    });
    //delete
    app.delete("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    });
  } finally {
  }
};

//catch any error while running server
run().catch((error) => console.log(error));

//base url response
app.get("/", (res) => {
  res.send("Simple CRUD Template");
});

//listen to the defined port for any event
app.listen(port, () => {
  console.log(`CRUD SERVER RUNNING ON PORT: ${port}!`);
});
