import { Redis } from "ioredis";

const redis = new Redis();

redis.set("test", "working");
redis.get("test").then(console.log);