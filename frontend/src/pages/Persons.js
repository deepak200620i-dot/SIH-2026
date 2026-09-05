import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { apiDeletePerson, apiGetPersons, apiUploadPerson } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
export const Persons = () => {
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [image, setImage] = useState(null);
    const [saving, setSaving] = useState(false);
    const load = async () => { setLoading(true); setPeople(await apiGetPersons()); setLoading(false); };
    useEffect(() => { load(); }, []);
    const upload = async (e) => { e.preventDefault(); if (!name.trim() || !image)
        return; setSaving(true); const person = await apiUploadPerson(name.trim(), image); setSaving(false); if (person) {
        setPeople(current => [person, ...current]);
        setName("");
        setImage(null);
    } };
    const remove = async (id) => { if (await apiDeletePerson(id))
        setPeople(current => current.filter(person => person.id !== id)); };
    if (loading)
        return _jsx(LoadingSpinner, {});
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Known Persons" }), _jsx("p", { className: "text-sm text-gray-500", children: "Face-gallery records used by the recognition engine." })] }), _jsxs("form", { onSubmit: upload, className: "panel p-4 flex flex-col md:flex-row gap-3", children: [_jsx("input", { value: name, onChange: e => setName(e.target.value), required: true, placeholder: "Person's name", className: "field flex-1" }), _jsx("input", { type: "file", accept: "image/*", required: true, onChange: e => setImage(e.target.files?.[0] || null), className: "field flex-1" }), _jsxs("button", { disabled: saving, className: "primary-button", children: [_jsx(Plus, { size: 16 }), saving ? "Uploading…" : "Add person"] })] }), people.length === 0 ? _jsxs("div", { className: "panel p-10 text-center text-gray-500", children: [_jsx(Users, { className: "mx-auto mb-3 text-maroon-700" }), "No known persons enrolled."] }) : _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4", children: people.map(person => _jsxs("div", { className: "panel overflow-hidden", children: [_jsx("div", { className: "aspect-square bg-maroon-50", children: person.photoUrl && _jsx("img", { src: person.photoUrl, alt: person.name, className: "h-full w-full object-cover" }) }), _jsxs("div", { className: "p-3 flex gap-2 items-center", children: [_jsx("p", { className: "font-medium text-sm truncate flex-1", children: person.name }), _jsx("button", { onClick: () => remove(person.id), className: "text-red-700 hover:text-red-900", "aria-label": `Remove ${person.name}`, children: _jsx(Trash2, { size: 16 }) })] })] }, person.id)) })] });
};
