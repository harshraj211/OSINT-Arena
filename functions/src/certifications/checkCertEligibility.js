const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { userId } = data

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    // Check if user is eligible for certification
    const userDoc = await admin.firestore().collection('users').doc(userId).get()
    const user = userDoc.data()

    const isEligible = user.solves >= 50 && user.elo >= 1800

    return { eligible: isEligible }
  } catch (error) {
    console.error('Error checking certification eligibility:', error)
    throw error
  }
})