import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name?: string
  email: string
  password?: string
  image?: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
