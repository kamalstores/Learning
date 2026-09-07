import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if(!localFilePath) return null

    // upload file to cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: 'auto', // this will automatically detect the file type
    })
    // console.log(response);
    

    // file has uploaded successfully

    // console.log("File uploaded to Cloudinary:", response.url)
    

    fs.unlinkSync(localFilePath) // Remove the file after upload
    
    return response
  } catch (error) {
        fs.unlinkSync(localFilePath) // Remove the locally saved temporary file as upload failed
        return null
    }
}

export { uploadOnCloudinary }