export const COLORS = ['#1e3a5f','#7c3aed','#059669','#b8860b','#dc2626','#0891b2'];

export const getColor = (n) => { 
  if (!n) return COLORS[0];
  let h=0; 
  for(let i=0;i<n.length;i++) h=n.charCodeAt(i)+((h<<5)-h); 
  return COLORS[Math.abs(h)%COLORS.length]; 
};

export const isActive = (a) => {
  if (a.role?.active === false) return false;
  const d = a.endDate;
  if (!d) return true;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end >= new Date();
};

export const fmtDate = (d) => {
  return d ? new Date(d).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : 'En cours';
};

export const getInitials = (firstName, lastName) =>
  `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
