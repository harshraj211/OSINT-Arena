const functions = require('firebase-functions')
const admin = require('firebase-admin')

module.exports = functions.auth.user().onCreate(async (user) => {
  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      elo: 1200,
      solves: 0
    })
  } catch (error) {
    console.error('Error creating user profile:', error)
  }
})