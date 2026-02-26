export const CertificationCard = ({ cert }) => (
  <div className="cert-card">
    <h4>{cert.name}</h4>
    <p>Earned on {cert.earnedDate}</p>
    <p>Valid until {cert.validUntil}</p>
  </div>
)