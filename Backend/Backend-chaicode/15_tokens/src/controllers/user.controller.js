import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"


const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }

}


const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validate user details
    // check if user already exists : username or email
    // check for image, check for avatar
    // upload them to cloudinary , avatar
    // create user object -- create entry in db
    // remove password, refresh token from response
    // check for user created or not
    // return response

    const {fullName, username, email, password} = req.body;

    // console.log(req.body)

    // console.log("fullName:", fullName);

    // if(fullName === ""){
    //     throw new ApiError(400, "Fullname is required");
    // }

    if(
        [fullName, username, email, password].some((field)=>{
            return field?.trim() === ""
        })
    ){
        throw new ApiError(400, "All fields are required");
    }


    const existedUser = await User.findOne({
        $or : [ { username}, {email} ]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists with this username or email");
    }
    // console.log(req.files);
    

    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path


    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar is required");
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "User not created, please try again");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    // req body -- data
    // username or email
    // find the user
    // password check
    // access token, refresh token
    // send cookie

    const {email, username, password} = req.body
    if(!(username || email)){
        throw new ApiError(400, "Username or email is required");
    }

    const user = await User.findOne({
        $or : [{email}, {username}]
    })

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Password is incorrect");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly : true,
        secure : true,
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user : loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            // $set : { 
            //     refreshToken : undefined
            // }

            $unset : {
                refreshToken : 1. // remove the field
            }
        },

        { new : true }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )

})


export {
    registerUser,
    loginUser,
    logoutUser
}