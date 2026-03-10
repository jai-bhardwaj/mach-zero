# Mach-Zero Infrastructure: Bare-metal-like cloud instance for low-latency trading
# Supports AWS (c5.metal / c5n.metal) and GCP (c2-standard-*)

variable "cloud_provider" {
  description = "Cloud provider: aws or gcp"
  type        = string
  default     = "aws"
}

variable "region" {
  description = "Cloud region"
  type        = string
  default     = "ap-south-1" # Mumbai for NSE proximity
}

variable "ssh_key_name" {
  description = "SSH key name for instance access"
  type        = string
}

# --- AWS Configuration ---

provider "aws" {
  region = var.region
}

resource "aws_instance" "trading_server" {
  count         = var.cloud_provider == "aws" ? 1 : 0
  ami           = "ami-0c55b159cbfafe1f0" # Ubuntu 22.04 LTS
  instance_type = "c5.metal"              # Bare metal, 96 vCPU, 192GB RAM

  key_name = var.ssh_key_name

  root_block_device {
    volume_type = "gp3"
    volume_size = 100
    iops        = 16000
    throughput  = 1000
  }

  # Enhanced networking
  associate_public_ip_address = true

  tags = {
    Name        = "mach-zero-trading"
    Environment = "production"
    Component   = "trading-engine"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # System tuning
    echo 'vm.nr_hugepages = 512' >> /etc/sysctl.conf
    echo 'net.core.busy_read = 50' >> /etc/sysctl.conf
    echo 'net.core.busy_poll = 50' >> /etc/sysctl.conf
    echo 'net.ipv4.tcp_low_latency = 1' >> /etc/sysctl.conf
    sysctl -p

    # Install dependencies
    apt-get update
    apt-get install -y build-essential cmake git libssl-dev zlib1g-dev \
      openjdk-17-jdk-headless docker.io docker-compose

    # Set up CPU isolation (requires reboot)
    sed -i 's/GRUB_CMDLINE_LINUX=""/GRUB_CMDLINE_LINUX="isolcpus=2,3,4,5 nohz_full=2,3,4,5 rcu_nocbs=2,3,4,5"/' /etc/default/grub
    update-grub
  EOF
}

output "trading_server_ip" {
  value = var.cloud_provider == "aws" ? (length(aws_instance.trading_server) > 0 ? aws_instance.trading_server[0].public_ip : "") : ""
}
