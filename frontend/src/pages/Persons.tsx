import React, { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Person } from "@/types";
import { apiDeletePerson, apiGetPersons, apiUploadPerson } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export const Persons: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]); const [loading, setLoading] = useState(true);
  const [name, setName] = useState(""); const [image, setImage] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  const load = async () => { setLoading(true); setPeople(await apiGetPersons()); setLoading(false); };
  useEffect(() => { load(); }, []);
  const upload = async (e: React.FormEvent) => { e.preventDefault(); if (!name.trim() || !image) return; setSaving(true); const person = await apiUploadPerson(name.trim(), image); setSaving(false); if (person) { setPeople(current => [person, ...current]); setName(""); setImage(null); } };
  const remove = async (id: string) => { if (await apiDeletePerson(id)) setPeople(current => current.filter(person => person.id !== id)); };
  if (loading) return <LoadingSpinner />;
  return <div className="p-6 space-y-6"><div><h1 className="text-2xl font-bold">Known Persons</h1><p className="text-sm text-gray-500">Face-gallery records used by the recognition engine.</p></div>
    <form onSubmit={upload} className="panel p-4 flex flex-col md:flex-row gap-3"><input value={name} onChange={e => setName(e.target.value)} required placeholder="Person's name" className="field flex-1"/><input type="file" accept="image/*" required onChange={e => setImage(e.target.files?.[0] || null)} className="field flex-1"/><button disabled={saving} className="primary-button"><Plus size={16}/>{saving ? "Uploading…" : "Add person"}</button></form>
    {people.length === 0 ? <div className="panel p-10 text-center text-gray-500"><Users className="mx-auto mb-3 text-maroon-700"/>No known persons enrolled.</div> : <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">{people.map(person => <div key={person.id} className="panel overflow-hidden"><div className="aspect-square bg-maroon-50">{person.photoUrl && <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover"/>}</div><div className="p-3 flex gap-2 items-center"><p className="font-medium text-sm truncate flex-1">{person.name}</p><button onClick={() => remove(person.id)} className="text-red-700 hover:text-red-900" aria-label={`Remove ${person.name}`}><Trash2 size={16}/></button></div></div>)}</div>}</div>;
};
