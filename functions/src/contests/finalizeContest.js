const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { contestId } = data

    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can finalize contests')
    }

    // Finalize contest and calculate results
    const contestRef = admin.firestore().collection('contests').doc(contestId)
    await contestRef.update({ status: 'completed' })

    return { success: true }
  } catch (error) {
    console.error('Error finalizing contest:', error)
    throw error
  }
})