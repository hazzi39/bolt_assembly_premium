interface BoltProperties {
  grade: string;
  size: string;
  phiVf: number;
  phiNtf: number;
  tensileArea: number;
  fuf: number;
}

export const boltData: BoltProperties[] = [
  { grade: "Grade 4.6", size: "M12", phiVf: 16.7, phiNtf: 27, tensileArea: 84.3, fuf: 400 },
  { grade: "Grade 4.6", size: "M16", phiVf: 31.1, phiNtf: 50.1, tensileArea: 156.7, fuf: 400 },
  { grade: "Grade 4.6", size: "M20", phiVf: 48.6, phiNtf: 78.3, tensileArea: 244.8, fuf: 400 },
  { grade: "Grade 4.6", size: "M22", phiVf: 60.2, phiNtf: 97.1, tensileArea: 303.4, fuf: 400 },
  { grade: "Grade 4.6", size: "M24", phiVf: 69.9, phiNtf: 112.8, tensileArea: 352.5, fuf: 400 },
  { grade: "Grade 4.6", size: "M27", phiVf: 91.1, phiNtf: 147, tensileArea: 459.4, fuf: 400 },
  { grade: "Grade 4.6", size: "M30", phiVf: 111.2, phiNtf: 179.4, tensileArea: 560.6, fuf: 400 },
  { grade: "Grade 4.6", size: "M36", phiVf: 162, phiNtf: 261.4, tensileArea: 816.7, fuf: 400 },
  { grade: "Grade 8.8", size: "M12", phiVf: 34.7, phiNtf: 56, tensileArea: 84.3, fuf: 830 },
  { grade: "Grade 8.8", size: "M16", phiVf: 64.5, phiNtf: 104, tensileArea: 156.7, fuf: 830 },
  { grade: "Grade 8.8", size: "M20", phiVf: 100.8, phiNtf: 162.5, tensileArea: 244.8, fuf: 830 },
  { grade: "Grade 8.8", size: "M22", phiVf: 124.9, phiNtf: 201.5, tensileArea: 303.4, fuf: 830 },
  { grade: "Grade 8.8", size: "M24", phiVf: 145.1, phiNtf: 234.1, tensileArea: 352.5, fuf: 830 },
  { grade: "Grade 8.8", size: "M27", phiVf: 189.1, phiNtf: 305, tensileArea: 459.4, fuf: 830 },
  { grade: "Grade 8.8", size: "M30", phiVf: 230.8, phiNtf: 372.2, tensileArea: 560.6, fuf: 830 },
  { grade: "Grade 8.8", size: "M36", phiVf: 336.2, phiNtf: 542.3, tensileArea: 816.7, fuf: 830 },
  { grade: "Grade 10.9", size: "M12", phiVf: 43.1, phiNtf: 69.4, tensileArea: 84.3, fuf: 1030 },
  { grade: "Grade 10.9", size: "M16", phiVf: 80, phiNtf: 129.1, tensileArea: 156.7, fuf: 1030 },
  { grade: "Grade 10.9", size: "M20", phiVf: 125.1, phiNtf: 201.7, tensileArea: 244.8, fuf: 1030 },
  { grade: "Grade 10.9", size: "M22", phiVf: 155, phiNtf: 250, tensileArea: 303.4, fuf: 1030 },
  { grade: "Grade 10.9", size: "M24", phiVf: 180.1, phiNtf: 290.5, tensileArea: 352.5, fuf: 1030 },
  { grade: "Grade 10.9", size: "M27", phiVf: 234.7, phiNtf: 378.6, tensileArea: 459.4, fuf: 1030 },
  { grade: "Grade 10.9", size: "M30", phiVf: 286.4, phiNtf: 461.9, tensileArea: 560.6, fuf: 1030 },
  { grade: "Grade 10.9", size: "M36", phiVf: 417.2, phiNtf: 673, tensileArea: 816.7, fuf: 1030 }
];

export const getBoltGrades = (): string[] => {
  return Array.from(new Set(boltData.map(bolt => bolt.grade)));
};

export const getBoltSizes = (grade: string): string[] => {
  return boltData.filter(bolt => bolt.grade === grade).map(bolt => bolt.size);
};

export const getBoltProperties = (grade: string, size: string): BoltProperties | undefined => {
  return boltData.find(bolt => bolt.grade === grade && bolt.size === size);
};

export type { BoltProperties };