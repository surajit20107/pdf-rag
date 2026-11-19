import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX); // pinecone db index name

async function clearVectorDB(namespace) {
  try {
    await index.namespace(namespace).deleteAll();
    console.log("Deleted all vectors in the namespace");
    process.exit(0);
  } catch (error) {
    console.error("Error deleting vectors:", error?.message);
    process.exit(1);
  }
}

clearVectorDB("__default__");
