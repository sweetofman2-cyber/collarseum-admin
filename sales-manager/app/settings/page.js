'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function ItemManager({ table, label, hasPrice }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name: '', price: '' })
  const [editId, setEditId] = useState(null)

  async function fetch_() {
    const { data } = await supabase.from(table).select('*').order('id')
    setItems(data || [])
  }
  useEffect(() => { fetch_() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('이름을 입력하세요.')
    const payload = { name: form.name, ...(hasPrice ? { price: Number(form.price) || 0 } : {}) }
    if (editId) {
      const { error } = await supabase.from(table).update(payload).eq('id', editId)
      if (error) toast.error('수정 실패')
      else { toast.success('수정되었습니다.'); setEditId(null) }
    } else {
      const { error } = await supabase.from(table).insert(payload)
      if (error) toast.error('추가 실패: ' + error.message)
      else toast.success('추가되었습니다.')
    }
    setForm({ name: '', price: '' })
    fetch_()
  }

  async function handleDelete(id) {
    if (!confirm('삭제할까요?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast.error('삭제 실패')
    else { toast.success('삭제됨'); fetch_() }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{label} 관리</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder={label + ' 이름'}
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
        {hasPrice && (
          <input
            type="number"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="가격 (원)"
            value={form.price}
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
          />
        )}
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">
          {editId ? '수정 저장' : '추가'}
        </button>
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setForm({ name: '', price: '' }) }}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">취소</button>
        )}
      </form>
      <ul className="divide-y">
        {items.map(item => (
          <li key={item.id} className="py-2 flex items-center justify-between text-sm">
            <span>{item.name} {hasPrice && <span className="text-gray-400 ml-2">{item.price?.toLocaleString()}원</span>}</span>
            <div className="flex gap-3">
              <button onClick={() => { setEditId(item.id); setForm({ name: item.name, price: item.price || '' }) }}
                className="text-indigo-500 hover:underline text-xs">수정</button>
              <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:underline text-xs">삭제</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">상품 / 채널 설정</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <ItemManager table="products" label="상품" hasPrice={true} />
        <ItemManager table="channels" label="구매 채널" hasPrice={false} />
      </div>
    </div>
  )
}
