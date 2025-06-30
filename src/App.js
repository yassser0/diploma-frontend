import { useEffect, useState } from "react";
import { ethers } from "ethers";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

// Mock du contrat pour la démonstration
const DiplomaRegistry = {
  abi: [
    "function admin() view returns (address)",
    "function addDiploma(address student, string name, string title, string institution, uint256 year)",
    "function updateDiploma(address student, uint256 index, string name, string title, string institution, uint256 year)",
    "function deleteDiploma(address student, uint256 index)",
    "function getDiplomas(address student) view returns (tuple(string studentName, string diplomaTitle, string institution, uint256 year)[])"
  ]
};

const contractAddress = "0x110795Df87F8B1DFdE00d76a03b4d52e32Bd9C73";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [admin, setAdmin] = useState("");
  const [studentAddress, setStudentAddress] = useState("");
  const [diplomas, setDiplomas] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", title: "", institution: "", year: ""
  });

  const isAdmin = account && admin && account.toLowerCase() === admin.toLowerCase();

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return alert("Veuillez installer MetaMask !");
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setAccount(await signer.getAddress());
        const instance = new ethers.Contract(contractAddress, DiplomaRegistry.abi, signer);
        setContract(instance);
      } catch (error) {
        console.error("Erreur d'initialisation:", error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const loadAdmin = async () => {
      if (contract) {
        try {
          setAdmin(await contract.admin());
        } catch (error) {
          console.error("Erreur lors du chargement de l'admin:", error);
        }
      }
    };
    loadAdmin();
  }, [contract]);

  useEffect(() => {
    const loadDiplomas = async () => {
      if (contract && account && admin && account.toLowerCase() !== admin.toLowerCase()) {
        try {
          setDiplomas(await contract.getDiplomas(account));
        } catch (error) {
          console.error("Erreur lors du chargement des diplômes:", error);
        }
      }
    };
    loadDiplomas();
  }, [contract, account, admin]);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addDiploma = async () => {
    if (!ethers.isAddress(studentAddress)) return alert("❌ Adresse Ethereum invalide !");
    if (!form.name || !form.title || !form.institution || !form.year) return alert("❌ Tous les champs sont obligatoires !");
    try {
      const tx = await contract.addDiploma(
        studentAddress.trim(),
        form.name.trim(),
        form.title.trim(),
        form.institution.trim(),
        parseInt(form.year)
      );
      await tx.wait();
      alert("🎓 Diplôme ajouté !");
      getDiplomasForAddress();
      setForm({ name: "", title: "", institution: "", year: "" });
    } catch (error) {
      alert("Erreur : " + (error?.reason || error?.message || JSON.stringify(error)));
    }
  };

  const updateDiploma = async () => {
    if (editIndex === null) return;
    try {
      const tx = await contract.updateDiploma(
        studentAddress.trim(), editIndex,
        form.name.trim(),
        form.title.trim(),
        form.institution.trim(),
        parseInt(form.year)
      );
      await tx.wait();
      alert("✏ Diplôme modifié !");
      setEditIndex(null);
      setForm({ name: "", title: "", institution: "", year: "" });
      getDiplomasForAddress();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  };

  const deleteDiploma = async (index) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce diplôme ?")) {
      try {
        const tx = await contract.deleteDiploma(studentAddress.trim(), index);
        await tx.wait();
        alert("🗑 Diplôme supprimé !");
        getDiplomasForAddress();
      } catch (error) {
        alert("Erreur suppression : " + error.message);
      }
    }
  };

  const getDiplomasForAddress = async () => {
    if (!ethers.isAddress(studentAddress)) return alert("❌ Adresse invalide !");
    try {
      const list = await contract.getDiplomas(studentAddress);
      setDiplomas(list);
    } catch (error) {
      console.error("Erreur lors de la récupération des diplômes:", error);
    }
  };

  const startEdit = (index) => {
    const d = diplomas[index];
    setForm({
      name: d.studentName,
      title: d.diplomaTitle,
      institution: d.institution,
      year: d.year.toString(),
    });
    setEditIndex(index);
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setForm({ name: "", title: "", institution: "", year: "" });
  };

  // ---- PDF avec QR Code + Hash + ID ----
 const exportPDF = async (d) => {
  try {
    // Génération des données de sécurité
    const certificateId = uuidv4();
    const hash = CryptoJS.SHA256(`${d.studentName}${d.diplomaTitle}${d.institution}${d.year}${certificateId}`).toString();
    const qrContent = `ID: ${certificateId}\nHash: ${hash}\nVérification: ${window.location.origin}/verify/${certificateId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 120,
      margin: 1,
      color: {
        dark: '#2C5282',
        light: '#FFFFFF'
      }
    });

    // Configuration du document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // === STYLES ET COULEURS ===
    const colors = {
      primary: '#1A365D',
      secondary: '#2C5282',
      accent: '#3182CE',
      gold: '#D69E2E',
      text: '#2D3748',
      lightGray: '#F7FAFC'
    };

    // === BORDURE DÉCORATIVE ===
    doc.setDrawColor(colors.primary);
    doc.setLineWidth(2);
    doc.rect(margin - 5, margin - 5, pageWidth - 2 * (margin - 5), pageHeight - 2 * (margin - 5));
    
    doc.setDrawColor(colors.gold);
    doc.setLineWidth(0.5);
    doc.rect(margin - 2, margin - 2, pageWidth - 2 * (margin - 2), pageHeight - 2 * (margin - 2));

    // === EN-TÊTE INSTITUTION ===
    doc.setFillColor(colors.primary);
    doc.rect(margin, margin, pageWidth - 2 * margin, 25, 'F');
    
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(24);
    doc.setFont("Helvetica", "bold");
    doc.text("RÉPUBLIQUE DU MAROC", pageWidth / 2, margin + 8, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("Helvetica", "normal");
    doc.text("MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR", pageWidth / 2, margin + 18, { align: 'center' });

    // === TITRE PRINCIPAL ===
    doc.setTextColor(colors.primary);
    doc.setFontSize(28);
    doc.setFont("Helvetica", "bold");
    doc.text("ATTESTATION DE RÉUSSITE", pageWidth / 2, 70, { align: 'center' });
    
    doc.setFontSize(20);
    doc.text("AU DIPLÔME", pageWidth / 2, 82, { align: 'center' });

    // === LIGNE DÉCORATIVE ===
    doc.setDrawColor(colors.gold);
    doc.setLineWidth(1);
    doc.line(margin + 30, 90, pageWidth - margin - 30, 90);

    // === CORPS DU DIPLÔME ===
    doc.setTextColor(colors.text);
    doc.setFontSize(14);
    doc.setFont("Helvetica", "normal");
    doc.text("Le Doyen de la Faculté certifie par la présente que le diplôme", pageWidth / 2, 110, { align: 'center' });

    // Titre du diplôme avec encadrement
    doc.setFillColor(colors.lightGray);
    doc.roundedRect(margin + 10, 120, pageWidth - 2 * (margin + 10), 16, 3, 3, 'F');
    
    doc.setTextColor(colors.secondary);
    doc.setFontSize(18);
    doc.setFont("Helvetica", "bold");
    doc.text(`"${d.diplomaTitle}"`, pageWidth / 2, 130, { align: 'center' });

    // Texte de décernement
    doc.setTextColor(colors.text);
    doc.setFontSize(14);
    doc.setFont("Helvetica", "normal");
    doc.text("a été décerné à :", pageWidth / 2, 150, { align: 'center' });

    // Nom de l'étudiant avec style élégant
    doc.setFillColor(colors.primary);
    doc.roundedRect(margin + 5, 160, pageWidth - 2 * (margin + 5), 20, 5, 5, 'F');
    
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(22);
    doc.setFont("Helvetica", "bolditalic");
    doc.text(`${d.studentName}`, pageWidth / 2, 172, { align: 'center' });

    // === DÉTAILS ACADÉMIQUES ===
    const detailsY = 200;
    doc.setTextColor(colors.text);
    doc.setFontSize(12);
    doc.setFont("Helvetica", "normal");

    // Institution
    doc.setFont("Helvetica", "bold");
    doc.text("Institution :", margin + 20, detailsY);
    doc.setFont("Helvetica", "normal");
    doc.text(`${d.institution}`, margin + 45, detailsY);

    // Année
    doc.setFont("Helvetica", "bold");
    doc.text("Année académique :", margin + 20, detailsY + 10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${d.year}`, margin + 60, detailsY + 10);

    // Date de délivrance
    const currentDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.setFont("Helvetica", "bold");
    doc.text("Délivré le :", margin + 20, detailsY + 20);
    doc.setFont("Helvetica", "normal");
    doc.text(currentDate, margin + 42, detailsY + 20);

    // === QR CODE ET SÉCURITÉ ===
    const qrY = pageHeight - 80;
    
    // Cadre pour QR code
    doc.setFillColor(colors.primary);
    doc.roundedRect(pageWidth - margin - 45, qrY - 5, 40, 50, 3, 3, 'F');
    
    doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - 42, qrY, 34, 34);
    
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.text("Vérification", pageWidth - margin - 25, qrY + 42, { align: 'center' });

    // Informations de sécurité
    doc.setTextColor(colors.text);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.text(`ID Certificat: ${certificateId}`, margin, qrY + 10);
    doc.text(`Hash de sécurité: ${hash.substring(0, 32)}...`, margin, qrY + 16);
    doc.text("Ce document est sécurisé par blockchain et vérifiable via QR code", margin, qrY + 22);

    

    // === FILIGRANE DE SÉCURITÉ ===
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.setTextColor(colors.primary);
    doc.setFontSize(60);
    doc.setFont("Helvetica", "bold");
    doc.text("AUTHENTIQUE", pageWidth / 2, pageHeight / 2, { 
      align: 'center',
      angle: 45
    });
    doc.restoreGraphicsState();

    // === SAUVEGARDE ===
    const fileName = `Diplome_${d.studentName.replace(/\s+/g, '_')}_${d.year}.pdf`;
    doc.save(fileName);

    return {
      success: true,
      certificateId,
      hash,
      fileName
    };

  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

  const filteredDiplomas = diplomas.filter((d) =>
    `${d.studentName} ${d.diplomaTitle} ${d.institution} ${d.year}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>🎓 Registre de Diplômes Pour La Faculté ben m'sik</h1>
          <p style={styles.subtitle}>Gestion sécurisée et vérifiable des diplômes</p>
        </div>
      </div>

      <div style={styles.mainContent}>
        {/* Status Cards */}
        <div style={styles.statusGrid}>
          <div style={styles.statusCard}>
            <div style={styles.statusIcon}>👤</div>
            <div>
              <h3 style={styles.statusTitle}>Compte connecté</h3>
              <p style={styles.statusValue}>{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Non connecté"}</p>
            </div>
          </div>
          
          <div style={styles.statusCard}>
            <div style={styles.statusIcon}>{isAdmin ? "🔐" : "👨‍🎓"}</div>
            <div>
              <h3 style={styles.statusTitle}>Statut</h3>
              <p style={styles.statusValue}>{isAdmin ? "Administrateur" : "Étudiant"}</p>
            </div>
          </div>
          
          <div style={styles.statusCard}>
            <div style={styles.statusIcon}>📊</div>
            <div>
              <h3 style={styles.statusTitle}>Diplômes</h3>
              <p style={styles.statusValue}>{filteredDiplomas.length}</p>
            </div>
          </div>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div style={styles.adminSection}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  {editIndex === null ? "🎓 Ajouter un diplôme" : "✏ Modifier un diplôme"}
                </h2>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.formGrid}>
                  <input
                    style={styles.input}
                    placeholder="Adresse de l'étudiant"
                    value={studentAddress}
                    onChange={(e) => setStudentAddress(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    name="name"
                    placeholder="Nom de l'étudiant"
                    value={form.name}
                    onChange={handleInput}
                  />
                  <input
                    style={styles.input}
                    name="title"
                    placeholder="Titre du diplôme"
                    value={form.title}
                    onChange={handleInput}
                  />
                  <input
                    style={styles.input}
                    name="institution"
                    placeholder="Institution"
                    value={form.institution}
                    onChange={handleInput}
                  />
                  <input
                    style={styles.input}
                    name="year"
                    placeholder="Année d'obtention"
                    type="number"
                    value={form.year}
                    onChange={handleInput}
                  />
                </div>
                <div style={styles.buttonGroup}>
                  <button
                    style={{...styles.button, ...styles.primaryButton}}
                    onClick={editIndex === null ? addDiploma : updateDiploma}
                  >
                    {editIndex === null ? "Ajouter le diplôme" : "Mettre à jour"}
                  </button>
                  {editIndex !== null && (
                    <button
                      style={{...styles.button, ...styles.secondaryButton}}
                      onClick={cancelEdit}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>📄 Consulter les diplômes</h2>
              </div>
              <div style={styles.cardBody}>
                <input
                  style={styles.input}
                  placeholder="Adresse de l'étudiant à consulter"
                  onChange={(e) => setStudentAddress(e.target.value)}
                />
                <button
                  style={{...styles.button, ...styles.primaryButton}}
                  onClick={getDiplomasForAddress}
                >
                  Voir les diplômes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diplomas List */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>🎓 Liste des diplômes</h2>
            <div style={styles.searchContainer}>
              <input
                style={styles.searchInput}
                placeholder="🔍 Rechercher un diplôme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={styles.cardBody}>
            {filteredDiplomas.length > 0 ? (
              <div style={styles.diplomaGrid}>
                {filteredDiplomas.map((d, i) => (
                  <div key={i} style={styles.diplomaCard}>
                    <div style={styles.diplomaHeader}>
                      <h3 style={styles.diplomaTitle}>{d.diplomaTitle}</h3>
                      <span style={styles.diplomaYear}>{d.year.toString()}</span>
                    </div>
                    <div style={styles.diplomaInfo}>
                      <p><strong>👤 Étudiant:</strong> {d.studentName}</p>
                      <p><strong>🏛 Institution:</strong> {d.institution}</p>
                    </div>
                    <div style={styles.diplomaActions}>
                      <button
                        style={{...styles.actionButton, ...styles.exportButton}}
                        onClick={() => exportPDF(d)}
                        title="Exporter en PDF"
                      >
                        📄
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            style={{...styles.actionButton, ...styles.editButton}}
                            onClick={() => startEdit(i)}
                            title="Modifier"
                          >
                            ✏
                          </button>
                          <button
                            style={{...styles.actionButton, ...styles.deleteButton}}
                            onClick={() => deleteDiploma(i)}
                            title="Supprimer"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📜</div>
                <h3 style={styles.emptyTitle}>Aucun diplôme trouvé</h3>
                <p style={styles.emptyText}>
                  {search ? "Aucun diplôme ne correspond à votre recherche." : "Aucun diplôme n'a été enregistré pour cette adresse."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '2rem 0',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'white',
    margin: '0 0 0.5rem 0',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: 0,
  },
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  statusCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  statusIcon: {
    fontSize: '2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#6b7280',
    margin: '0 0 0.25rem 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusValue: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0,
  },
  adminSection: {
    display: 'grid',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  cardHeader: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    margin: 0,
  },
  cardBody: {
    padding: '1.5rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxSizing: 'border-box',
  },
  searchContainer: {
    flex: 1,
    maxWidth: '300px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '6px',
    fontSize: '0.9rem',
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    outline: 'none',
    boxSizing: 'border-box',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  secondaryButton: {
    background: '#f3f4f6',
    color: '#374151',
    border: '2px solid #e5e7eb',
  },
  diplomaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  diplomaCard: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.5rem',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  diplomaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    gap: '1rem',
  },
  diplomaTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    flex: 1,
  },
  diplomaYear: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  diplomaInfo: {
    marginBottom: '1rem',
  },
  diplomaActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  exportButton: {
    background: '#10b981',
    color: 'white',
  },
  editButton: {
    background: '#f59e0b',
    color: 'white',
  },
  deleteButton: {
    background: '#ef4444',
    color: 'white',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#6b7280',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  emptyText: {
    fontSize: '1rem',
    margin: 0,
  },
};

export default App;