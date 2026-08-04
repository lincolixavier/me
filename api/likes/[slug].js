import { counter } from "../_counter.js";

export default counter({ name: "likes", limit: 30, methods: ["GET", "POST", "DELETE"] });
