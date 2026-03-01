const functions = require("firebase-functions")
const admin = require("firebase-admin")

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { userId, challengeId } = data

    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated")
    }

    // Check and award badges based on achievements
    const userRef = admin.firestore().collection("users").doc(userId)
    const userDoc = await userRef.get()
    const user = userDoc.data()

    const badges = []
    if (user.solves >= 10) badges.push("first_10")
    if (user.elo >= 1600) badges.push("rising_star")

    if (badges.length > 0) {
      await userRef.update({ badges: admin.firestore.FieldValue.arrayUnion(...badges) })
    }

    return { success: true, badges }
  } catch (error) {
    console.error("Error checking badges:", error)
    throw error
  }
})