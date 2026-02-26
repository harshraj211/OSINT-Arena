const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.https.onCall(async (data, context) => {
  try {
    const { userId, role } = data
    
    // Verify caller is admin
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can set custom claims')
    }

    await admin.auth().setCustomUserClaims(userId, { role })
    return { success: true }
  } catch (error) {
    console.error('Error setting custom claims:', error)
    throw error
  }
})