import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  Plus, 
  MessageCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Send,
  Search,
  Filter,
  HelpCircle,
  FileText,
  Trash2
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomerSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    category: 'general',
    order_id: '',
    description: '',
    priority: 'normal'
  });

  const faqs = [
    {
      category: 'Orders',
      questions: [
        {
          q: 'How do I track my order?',
          a: 'Go to "My Orders" and click on any order to see real-time tracking with driver location on the map.'
        },
        {
          q: 'Can I cancel my order?',
          a: 'Yes, you can cancel orders that haven\'t been picked up yet. Go to your order and click "Cancel Order".'
        },
        {
          q: 'How long does delivery take?',
          a: 'Typical delivery time is 30-45 minutes depending on your location and restaurant preparation time.'
        }
      ]
    },
    {
      category: 'Payments',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept credit/debit cards, Apple Pay, Google Pay, PayPal, and cash on delivery.'
        },
        {
          q: 'How do refunds work?',
          a: 'Refunds are processed within 5-7 business days back to your original payment method.'
        },
        {
          q: 'Do you accept promo codes?',
          a: 'Yes! Enter your promo code at checkout to get discounts on your order.'
        }
      ]
    },
    {
      category: 'Account',
      questions: [
        {
          q: 'How do I update my delivery address?',
          a: 'Go to "My Addresses" in your profile to add, edit, or delete delivery addresses.'
        },
        {
          q: 'Can I save multiple addresses?',
          a: 'Yes! You can save Home, Work, and other addresses for quick selection during checkout.'
        },
        {
          q: 'How do I change my password?',
          a: 'Go to Settings → Security → Change Password to update your account password.'
        }
      ]
    }
  ];

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchTicketMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/support/tickets`, {
        withCredentials: true
      });
      setTickets(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setLoading(false);
    }
  };

  const fetchTicketMessages = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/support/tickets/${ticketId}/messages`, {
        withCredentials: true
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`${API}/support/tickets`, newTicketData, {
        withCredentials: true
      });

      setShowNewTicketModal(false);
      fetchTickets();
      setNewTicketData({
        subject: '',
        category: 'general',
        order_id: '',
        description: '',
        priority: 'normal'
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      await axios.post(`${API}/support/tickets/${selectedTicket.id}/messages`, {
        message: newMessage,
        sender_type: 'customer'
      }, {
        withCredentials: true
      });

      setNewMessage('');
      fetchTicketMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      await axios.put(`${API}/support/tickets/${ticketId}/close`, {}, {
        withCredentials: true
      });
      fetchTickets();
      setSelectedTicket(null);
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-turquoise-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Support</h1>
              <p className="text-gray-600">Get help with your orders and account</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowFAQ(!showFAQ)} variant="outline">
                <HelpCircle className="h-5 w-5 mr-2" />
                FAQ
              </Button>
              <Button onClick={() => setShowNewTicketModal(true)} className="bg-turquoise-600 hover:bg-turquoise-700">
                <Plus className="h-5 w-5 mr-2" />
                New Ticket
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Tickets</p>
                    <p className="text-2xl font-bold">{tickets.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Open</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {tickets.filter(t => t.status === 'open').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {tickets.filter(t => t.status === 'in_progress').length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        {showFAQ && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Frequently Asked Questions</span>
                <button onClick={() => setShowFAQ(false)}>
                  <X className="h-6 w-6" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {faqs.map((category, idx) => (
                  <div key={idx}>
                    <h3 className="font-semibold text-lg mb-3">{category.category}</h3>
                    <div className="space-y-4">
                      {category.questions.map((faq, qIdx) => (
                        <div key={qIdx} className="p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">{faq.q}</h4>
                          <p className="text-sm text-gray-600">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tickets Section */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Tickets List */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>My Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">No support tickets yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full text-left p-4 rounded-lg transition-colors ${
                          selectedTicket?.id === ticket.id
                            ? 'bg-turquoise-50 border-2 border-turquoise-500'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm line-clamp-1">{ticket.subject}</h4>
                          <Badge className={getStatusColor(ticket.status)} size="sm">
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(ticket.priority)} size="sm">
                            {ticket.priority}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ticket Details & Chat */}
          <div className="md:col-span-2">
            {selectedTicket ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{selectedTicket.subject}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusColor(selectedTicket.status)}>
                          {selectedTicket.status}
                        </Badge>
                        <Badge className={getPriorityColor(selectedTicket.priority)}>
                          {selectedTicket.priority} priority
                        </Badge>
                        <span className="text-sm text-gray-500">
                          Ticket #{selectedTicket.id?.substring(0, 8)}
                        </span>
                      </div>
                    </div>
                    {selectedTicket.status !== 'closed' && (
                      <Button
                        onClick={() => handleCloseTicket(selectedTicket.id)}
                        variant="outline"
                        size="sm"
                      >
                        Close Ticket
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Initial Description */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-2">Original Issue:</p>
                    <p className="text-sm text-gray-600">{selectedTicket.description}</p>
                    {selectedTicket.order_id && (
                      <p className="text-xs text-gray-500 mt-2">
                        Related Order: #{selectedTicket.order_id?.substring(0, 8)}
                      </p>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="mb-4">
                    <div className="h-96 overflow-y-auto space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${
                            msg.sender_type === 'customer'
                              ? 'bg-turquoise-100 ml-auto max-w-[80%]'
                              : 'bg-white mr-auto max-w-[80%]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.sender_type === 'customer' ? 'You' : 'Support Agent'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Send Message */}
                    {selectedTicket.status !== 'closed' && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button onClick={handleSendMessage}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No ticket selected</h3>
                  <p className="text-gray-600">Select a ticket to view details and chat with support</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* New Ticket Modal */}
        {showNewTicketModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Create Support Ticket</span>
                  <button onClick={() => setShowNewTicketModal(false)}>
                    <X className="h-6 w-6" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Subject *</label>
                    <Input
                      required
                      value={newTicketData.subject}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Brief description of your issue"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category *</label>
                      <select
                        required
                        value={newTicketData.category}
                        onChange={(e) => setNewTicketData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="general">General Inquiry</option>
                        <option value="order_issue">Order Issue</option>
                        <option value="payment">Payment Problem</option>
                        <option value="refund">Refund Request</option>
                        <option value="account">Account Issue</option>
                        <option value="technical">Technical Problem</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Priority</label>
                      <select
                        value={newTicketData.priority}
                        onChange={(e) => setNewTicketData(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Order ID (if applicable)</label>
                    <Input
                      value={newTicketData.order_id}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, order_id: e.target.value }))}
                      placeholder="Enter order ID"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description *</label>
                    <textarea
                      required
                      rows={5}
                      value={newTicketData.description}
                      onChange={(e) => setNewTicketData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                      placeholder="Please describe your issue in detail..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowNewTicketModal(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-turquoise-600 hover:bg-turquoise-700">
                      Create Ticket
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSupport;
