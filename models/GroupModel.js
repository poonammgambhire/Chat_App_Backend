import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  description: {
    type: String,
    default: "",
    maxlength: 150,
  },
  groupPic: {
    type: String,
    default: "",
  },

  // Admin — group बनवणारा
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Members list
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

}, { timestamps: true });

const Group = mongoose.model("Group", groupSchema);
export default Group;