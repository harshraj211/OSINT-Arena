const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { contestId } = data

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid

    // Register user for contest
    await admin.firestore()
      .collection('contests')
      .doc(contestId)
      .collection('participants')
      .doc(userId)
      .set({ registeredAt: admin.firestore.FieldValue.serverTimestamp() })

    return { success: true }
  } catch (error) {
    console.error('Error registering for contest:', error)
    throw error
  }
})