const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { contestId, challengeId, answer } = data

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid

    // Submit contest answer
    await admin.firestore()
      .collection('contests')
      .doc(contestId)
      .collection('submissions')
      .add({
        userId,
        challengeId,
        answer,
        submittedAt: admin.firestore.FieldValue.serverTimestamp()
      })

    return { success: true }
  } catch (error) {
    console.error('Error submitting contest answer:', error)
    throw error
  }
})