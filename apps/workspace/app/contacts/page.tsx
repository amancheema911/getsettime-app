"use client";

import { useState } from "react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  city: string;
  state: string;
  country: string;
}

export default function ContactsCreative({ }) {
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: "1",
      name: "Roshan",
      email: "aboutroshan13@gmail.com",
      phone: "+91 95306 93882",
      timezone: "India, Sri Lanka Time",
      city: "in",
      state: "jkk",
      country: "IN",
    },
    {
      id: "2",
      name: "Test",
      email: "calsmith348@gmail.com",
      phone: "",
      timezone: "India, Sri Lanka Time",
      city: "",
      state: "",
      country: "",
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<Omit<Contact, "id">>({
    name: "",
    email: "",
    phone: "",
    timezone: "India, Sri Lanka Time",
    city: "",
    state: "",
    country: "",
  });

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      timezone: "India, Sri Lanka Time",
      city: "",
      state: "",
      country: "",
    });
    setShowModal(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      timezone: contact.timezone,
      city: contact.city,
      state: contact.state,
      country: contact.country,
    });
    setShowModal(true);
  };

  const handleDeleteContact = (id: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(contacts.filter((contact) => contact.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      // Update existing contact
      setContacts(
        contacts.map((contact) =>
          contact.id === editingContact.id ? { ...formData, id: editingContact.id } : contact
        )
      );
    } else {
      // Add new contact
      const newContact: Contact = {
        ...formData,
        id: Date.now().toString(),
      };
      setContacts([...contacts, newContact]);
    }
    setShowModal(false);
    setEditingContact(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      timezone: "India, Sri Lanka Time",
      city: "",
      state: "",
      country: "",
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      timezone: "India, Sri Lanka Time",
      city: "",
      state: "",
      country: "",
    });
  };

  return (
    <section className="space-y-6 mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Contacts</h3>
          <p className="text-xs text-slate-500">Manage your contacts.</p>
        </div>
        <button 
          onClick={() => (showModal ? handleCloseModal() : handleAddContact())}
          className="cursor-pointer text-sm font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          {showModal ? "Cancel" : "+ Add Contact"}
        </button>
      </header>

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Bar */}
        <div className="w-full md:w-1/2 mt-4 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name and email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="border border-slate-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Phone number</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Time zone</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">State</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Country</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    No contacts found
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Name">
                      <div className="item-align-end flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-700">
                          {getInitials(contact.name)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{contact.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Email">
                      <span className="text-sm text-slate-600">{contact.email}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Phone number">
                      <span className="text-sm text-slate-600">{contact.phone || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Time zone">
                      <span className="text-sm text-slate-600">{contact.timezone}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="City">
                      <span className="text-sm text-slate-600">{contact.city || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="State">
                      <span className="text-sm text-slate-600">{contact.state || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Country">
                      <span className="text-sm text-slate-600">{contact.country || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="Action">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditContact(contact)} className="cursor-pointer inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100" title="Edit">Edit</button>
                        <button onClick={() => handleDeleteContact(contact.id)} className="cursor-pointer inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10 hover:bg-red-100" title="Delete">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Contact Form */}
      {showModal && (
        <div className={`fixed inset-0 z-99999 m-0 flex justify-end transition-opacity duration-200 ${showModal ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleCloseModal} />
          <div className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showModal ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{editingContact ? "Update Contact" : "Create New Contact"}</h3>
                <p className="text-xs uppercase tracking-wide text-gray-500">{editingContact ? "Modify your contact details below." : "Quickly add a new contact to your list."}</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" onClick={handleCloseModal} aria-label="Close contact form">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={!!editingContact}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    className={`w-full px-4 py-2 rounded-lg border border-slate-300 outline-none ${
                      editingContact 
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
                        : 'focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +1 234 567 8900"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-1">Time zone</label>
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="India, Sri Lanka Time">India, Sri Lanka Time</option>
                    <option value="Pacific Standard Time">Pacific Standard Time</option>
                    <option value="Eastern Standard Time">Eastern Standard Time</option>
                    <option value="Central European Time">Central European Time</option>
                    <option value="Japan Standard Time">Japan Standard Time</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. New York"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. California"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. USA"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                  <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium">{editingContact ? "Update Contact" : "Add Contact"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}