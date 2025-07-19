import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Video,
  Image,
  Code,
  Zap,
  Shield,
  GithubIcon
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import logo from '../../logo.png';

export const Landing: React.FC = () => {
  const features = [
    {
      icon: <Image className="text-blue-400" size={24} />,
      title: 'Image Processing',
      description: 'Convert formats, resize, and optimize images — fast and efficiently.'
    },
    {
      icon: <Video className="text-purple-400" size={24} />,
      title: 'Video Editing',
      description: 'Trim, crop, and encode videos with pixel-perfect precision.'
    },
    {
      icon: <FileText className="text-green-400" size={24} />,
      title: 'Document Intelligence',
      description: 'Extract text from PDFs, process CSVs, and analyze content at scale.'
    },
    {
      icon: <Code className="text-orange-400" size={24} />,
      title: 'Code Execution',
      description: 'Run code in real-time — Python, JavaScript, and more with full output.'
    },
    {
      icon: <GithubIcon className="text-pink-400" size={24} />,
      title: 'GitHub Deploy',
      description: 'Deploy GitHub projects to a live environment in just a few clicks.'
    },
    {
      icon: <Zap className="text-yellow-400" size={24} />,
      title: 'Lightning Fast',
      description: 'Docker-powered speed ensures rapid processing for all your tasks.'
    },
    {
      icon: <Shield className="text-red-400" size={24} />,
      title: 'Secure by Design',
      description: 'All files are handled with encryption, cleanup, and full privacy control.'
    }
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2"
            >
              <img
                src={logo}
                alt="Docklet Logo"
                className="w-8 h-8 rounded-md object-cover"
              />
              <span className="text-xl font-bold text-white">Docklet</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-4"
            >
              <Link to="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button>Get Started</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Process, Execute & Deploy
            <span className="bg-gradient-to-r from-blue-400 to-black-500 bg-clip-text text-transparent block">
              With Docker Superpowers
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            From converting files and executing code to deploying your GitHub repositories —
            Docklet is your all-in-one processing engine built on Docker and designed for speed.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Link to="/register">
              <Button size="lg" className="px-8 py-4 text-lg">
                Start for Free
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Built for Developers & Creators
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every tool you need to automate workflows and ship faster
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card hover className="h-full">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <Card className="p-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to accelerate your workflow?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join developers transforming the way they build, run, and deploy files with Docklet.
            </p>
            <Link to="/register">
              <Button size="lg" className="px-8 py-4 text-lg">
                Create Free Account
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900/50 backdrop-blur-xl border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-400">
              © 2025 Docklet. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
