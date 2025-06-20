import { useEffect, useState } from "react";
import { ethers } from "ethers";
import jsPDF from "jspdf";
import DiplomaRegistry from "./contracts/DiplomaRegistry.json";
import 'bootstrap/dist/css/bootstrap.min.css';

const contractAddress = "0x367badc76Fe9B624662007Ffb65DaE924F276c4F";

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

  // 1. Connexion + Contrat
  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return alert("Veuillez installer MetaMask !");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setAccount(userAddress);

      const instance = new ethers.Contract(contractAddress, DiplomaRegistry.abi, signer);
      setContract(instance);
    };
    init();
  }, []);

  // 2. Charger admin après contrat initialisé
  useEffect(() => {
    const fetchAdmin = async () => {
      if (contract) {
        const adminAddr = await contract.admin();
        setAdmin(adminAddr);
      }
    };
    fetchAdmin();
  }, [contract]);

  // 3. Charger diplômes automatiquement si étudiant connecté
  useEffect(() => {
    const loadDiplomas = async () => {
      if (contract && account && admin && account.toLowerCase() !== admin.toLowerCase()) {
        const result = await contract.getDiplomas(account);
        setDiplomas(result);
      }
    };
    loadDiplomas();
  }, [contract, account, admin]);

  const handleInput = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addDiploma = async () => {
    if (!ethers.isAddress(studentAddress)) return alert("❌ Adresse Ethereum invalide !");
    if (!form.name || !form.title || !form.institution || !form.year) return alert("❌ Tous les champs sont obligatoires !");
    try {
      const tx = await contract.addDiploma(studentAddress.trim(), form.name.trim(), form.title.trim(), form.institution.trim(), parseInt(form.year));
      await tx.wait();
      alert("🎓 Diplôme ajouté !");
      getDiplomasForAddress();
    } catch (error) {
      alert("Erreur : " + (error?.reason || error?.message || JSON.stringify(error)));
    }
  };

  const updateDiploma = async () => {
    if (editIndex === null) return;
    try {
      const tx = await contract.updateDiploma(studentAddress.trim(), editIndex, form.name.trim(), form.title.trim(), form.institution.trim(), parseInt(form.year));
      await tx.wait();
      alert("✏️ Diplôme modifié !");
      setEditIndex(null);
      getDiplomasForAddress();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  };

  const deleteDiploma = async (index) => {
    try {
      const tx = await contract.deleteDiploma(studentAddress.trim(), index);
      await tx.wait();
      alert("🗑️ Diplôme supprimé !");
      getDiplomasForAddress();
    } catch (error) {
      alert("Erreur suppression : " + error.message);
    }
  };

  const getDiplomasForAddress = async () => {
    if (!ethers.isAddress(studentAddress)) return alert("❌ Adresse invalide !");
    const list = await contract.getDiplomas(studentAddress);
    setDiplomas(list);
  };

  const startEdit = (index) => {
    const d = diplomas[index];
    setForm({ name: d.studentName, title: d.diplomaTitle, institution: d.institution, year: d.year.toString() });
    setEditIndex(index);
  };

  const exportPDF = (d) => {
    const doc = new jsPDF();
    doc.setFontSize(16).text("🎓 Diplôme certifié", 20, 20);
    doc.setFontSize(12);
    doc.text(`👤 Nom : ${d.studentName}`, 20, 40);
    doc.text(`📘 Titre : ${d.diplomaTitle}`, 20, 50);
    doc.text(`🏛️ Institution : ${d.institution}`, 20, 60);
    doc.text(`📅 Année : ${d.year}`, 20, 70);
    doc.save(`Diplome_${d.studentName}_${d.year}.pdf`);
  };

  const filteredDiplomas = diplomas.filter((d) =>
    `${d.studentName} ${d.diplomaTitle} ${d.institution} ${d.year}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-4">
      <div className="alert alert-success">✅ Connecté : <strong>{account}</strong></div>
      {!admin ? (
        <div className="alert alert-info">⏳ Chargement de l’administrateur...</div>
      ) : (
        <div className={`alert ${isAdmin ? "alert-secondary" : "alert-warning"}`}>
          {isAdmin ? <>🔐 Admin du contrat : <strong>{admin}</strong></> : <>👨‍🎓 Espace étudiant</>}
        </div>
      )}

      {isAdmin && (
        <>
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              {editIndex === null ? "🎓 Ajouter un diplôme" : "✏️ Modifier un diplôme"}
            </div>
            <div className="card-body">
              <input className="form-control mb-2" placeholder="Adresse étudiant" value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} />
              {["name", "title", "institution", "year"].map((field) => (
                <input key={field} name={field} className="form-control mb-2" placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]} onChange={handleInput} />
              ))}
              <button className="btn btn-success w-100" onClick={editIndex === null ? addDiploma : updateDiploma}>
                {editIndex === null ? "Ajouter" : "Mettre à jour"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-dark text-white">📄 Voir les diplômes d’un étudiant</div>
            <div className="card-body">
              <input className="form-control mb-2" placeholder="Adresse étudiante à consulter" onChange={(e) => setStudentAddress(e.target.value)} />
              <button className="btn btn-primary w-100 mb-3" onClick={getDiplomasForAddress}>Voir les diplômes</button>
            </div>
          </div>
        </>
      )}

      <div className="card mt-4">
        <div className="card-header bg-info text-white">🎓 Diplômes trouvés</div>
        <div className="card-body">
          <input className="form-control mb-3" placeholder="🔍 Rechercher un diplôme..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {filteredDiplomas.length > 0 ? (
            <table className="table table-striped">
              <thead><tr><th>Nom</th><th>Titre</th><th>Institution</th><th>Année</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredDiplomas.map((d, i) => (
                  <tr key={i}>
                    <td>{d.studentName}</td>
                    <td>{d.diplomaTitle}</td>
                    <td>{d.institution}</td>
                    <td>{d.year.toString()}</td>
                    <td>
                      <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => exportPDF(d)}>📄</button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-outline-warning btn-sm me-1" onClick={() => startEdit(i)}>✏️</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => deleteDiploma(i)}>🗑️</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-muted">Aucun diplôme trouvé.</div>}
        </div>
      </div>
    </div>
  );
}

export default App;
